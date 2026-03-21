use std::sync::Arc;
use axum::{extract::State, Json};
use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use tokio::task::JoinSet;

use crate::{
    auth::middleware::AuthUser,
    db::{compensation, pluggy_items, positions},
    domain::{
        projections::{self, Position, ProjectionDataPoint, ProjectionParams},
        taxes::{self, AnnualBonuses, MonthlyIncome},
    },
    error::AppError,
    state::AppState,
};

// ── Config endpoint types ─────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ProjectionsConfigRates {
    pub cdi_annual: f64,
    pub ipca_annual: f64,
}

#[derive(Debug, Serialize)]
pub struct ProjectionsConfigExpenses {
    pub average_monthly_expenses: f64,
    pub months_analyzed: usize,
}

#[derive(Debug, Serialize)]
pub struct ProjectionsConfigCompensation {
    pub gross_salary: f64,
    pub deductions: Vec<CompensationDeduction>,
    pub thirteenth_received: f64,
    pub vacation_third_received: f64,
    pub compound_savings: bool,
}

#[derive(Debug, Serialize)]
pub struct CompensationDeduction {
    pub name: String,
    pub amount: f64,
}

#[derive(Debug, Serialize)]
pub struct ProjectionsConfigResponse {
    pub rates: Option<ProjectionsConfigRates>,
    pub expenses: Option<ProjectionsConfigExpenses>,
    pub compensation: Option<ProjectionsConfigCompensation>,
}

// ── Compute endpoint types ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ProjectionsComputeRequest {
    pub cdi_annual: f64,
    pub ipca_annual: f64,
    pub gross_salary: f64,
    pub other_deductions: f64,
    pub avg_monthly_expenses: f64,
    pub thirteenth_received: f64,
    pub vacation_third_received: f64,
    pub compound_savings: bool,
}

#[derive(Debug, Serialize)]
pub struct ProjectionsComputeResponse {
    pub monthly_income: Option<MonthlyIncome>,
    pub annual_bonuses: Option<AnnualBonuses>,
    pub projection: Vec<ProjectionDataPoint>,
    pub summary: ProjectionSummary,
    pub income_schedule: Vec<IncomeScheduleRow>,
}

#[derive(Debug, Serialize)]
pub struct ProjectionSummary {
    pub current_total: f64,
    pub end_of_year_total: f64,
    pub end_of_year_label: String,
    pub growth_percentage: f64,
    pub monthly_surplus: f64,
}

#[derive(Debug, Serialize)]
pub struct IncomeScheduleRow {
    pub month: String,
    pub month_idx: u32,
    pub gross: f64,
    pub inss: f64,
    pub irrf: f64,
    pub other_deductions: f64,
    pub net: f64,
    pub note: String,
}

const MONTH_NAMES: [&str; 12] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// ── BCB rate fetching (reused from routes/rates.rs) ───────────────────

#[derive(serde::Deserialize)]
struct BcbDataPoint {
    valor: String,
}

async fn fetch_bcb_rates() -> Option<ProjectionsConfigRates> {
    let client = reqwest::Client::new();

    let (cdi_res, ipca_res) = tokio::join!(
        client
            .get("https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json")
            .send(),
        client
            .get("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json")
            .send(),
    );

    let cdi_data: Vec<BcbDataPoint> = cdi_res.ok()?.json().await.ok()?;
    let ipca_data: Vec<BcbDataPoint> = ipca_res.ok()?.json().await.ok()?;

    let cdi_annual = cdi_data
        .first()
        .and_then(|d| d.valor.replace(',', ".").parse::<f64>().ok())?;

    let ipca_annual = ipca_data
        .iter()
        .try_fold(1.0_f64, |acc, d| {
            d.valor
                .replace(',', ".")
                .parse::<f64>()
                .map(|v| acc * (1.0 + v / 100.0))
                .ok()
        })
        .map(|compounded| (compounded - 1.0) * 100.0)?;

    Some(ProjectionsConfigRates {
        cdi_annual,
        ipca_annual,
    })
}

// ── Expense calculation (reused from routes/accounts.rs) ──────────────

const EXCLUDED_EXPENSE_CATEGORIES: &[&str] = &[
    "Transfer",
    "Transfers",
    "Same ownership transfer",
    "Same person transfer",
    "Fixed income",
    "Investments",
];

async fn fetch_average_expenses(
    state: &Arc<AppState>,
    items: &[crate::db::pluggy_items::PluggyItem],
) -> Option<ProjectionsConfigExpenses> {
    if items.is_empty() {
        return None;
    }

    // Get all checking account IDs
    let mut account_ids = Vec::new();
    for item in items {
        if let Ok(accounts) = state.pluggy_client.get_checking_accounts(&item.pluggy_item_id).await {
            for a in accounts {
                account_ids.push(a.id);
            }
        }
    }

    if account_ids.is_empty() {
        return None;
    }

    // 6 months window
    let now = chrono::Utc::now().date_naive();
    let six_months_ago = now - chrono::Months::new(6);
    let from_str = six_months_ago.format("%Y-%m-%d").to_string();
    let to_str = now.format("%Y-%m-%d").to_string();

    let mut monthly_totals: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for account_id in &account_ids {
        if let Ok(transactions) = state
            .pluggy_client
            .get_all_transactions(account_id, Some(&from_str), Some(&to_str))
            .await
        {
            for tx in transactions {
                if tx.amount >= 0.0 {
                    continue;
                }
                if let Some(ref cat) = tx.category {
                    if EXCLUDED_EXPENSE_CATEGORIES
                        .iter()
                        .any(|t| cat.eq_ignore_ascii_case(t))
                    {
                        continue;
                    }
                }
                let year_month: String = tx.date.chars().take(7).collect();
                *monthly_totals.entry(year_month).or_default() += tx.amount.abs();
            }
        }
    }

    let months_analyzed = monthly_totals.len();
    if months_analyzed == 0 {
        return None;
    }

    let total: f64 = monthly_totals.values().sum();
    let average = ((total / months_analyzed as f64) * 100.0).round() / 100.0;

    Some(ProjectionsConfigExpenses {
        average_monthly_expenses: average,
        months_analyzed,
    })
}

// ── Config handler ────────────────────────────────────────────────────

pub async fn config(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProjectionsConfigResponse>, AppError> {
    // Parallel: rates from BCB, expenses from Pluggy, compensation config from DB
    let (items_result, config_result) = tokio::join!(
        pluggy_items::list_items(&state.db, &auth.id),
        compensation::get_config(&state.db, &auth.id, &auth.encryption_key),
    );

    let items = items_result?;
    let comp_config = config_result?;

    // Rates and expenses can be fetched in parallel
    let state_clone = state.clone();
    let items_clone = items.clone();
    let (rates, expenses) = tokio::join!(
        fetch_bcb_rates(),
        fetch_average_expenses(&state_clone, &items_clone),
    );

    let compensation = comp_config.map(|c| {
        let current_year = chrono::Utc::now().date_naive().year();
        let (thirteenth, vacation_third) = if c.bonus_year == Some(current_year) {
            (c.thirteenth_received, c.vacation_third_received)
        } else {
            (0.0, 0.0)
        };
        ProjectionsConfigCompensation {
            gross_salary: c.gross_salary,
            deductions: c
                .deductions
                .into_iter()
                .map(|d| CompensationDeduction {
                    name: d.name,
                    amount: d.amount,
                })
                .collect(),
            thirteenth_received: thirteenth,
            vacation_third_received: vacation_third,
            compound_savings: c.compound_savings,
        }
    });

    Ok(Json(ProjectionsConfigResponse {
        rates,
        expenses,
        compensation,
    }))
}

// ── Compute handler ───────────────────────────────────────────────────

pub async fn compute(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<ProjectionsComputeRequest>,
) -> Result<Json<ProjectionsComputeResponse>, AppError> {
    // Fetch investment positions and accounts balance
    let (items_result, manual_result) = tokio::join!(
        pluggy_items::list_items(&state.db, &auth.id),
        positions::list_positions(&state.db, &auth.id, &auth.encryption_key),
    );

    let items = items_result?;
    let manual_positions = manual_result?;

    // Fetch positions from all Pluggy items and accounts balance in parallel
    let mut pluggy_positions: Vec<Position> = Vec::new();
    let mut accounts_balance = 0.0f64;

    if !items.is_empty() {
        let mut invest_handles = JoinSet::new();
        let mut account_handles = JoinSet::new();

        for item in &items {
            let st = state.clone();
            let item_id = item.pluggy_item_id.clone();
            invest_handles.spawn(async move {
                st.pluggy_client.get_investments(&item_id).await
            });

            let st = state.clone();
            let item_id = item.pluggy_item_id.clone();
            account_handles.spawn(async move {
                st.pluggy_client.get_checking_accounts(&item_id).await
            });
        }

        while let Some(result) = invest_handles.join_next().await {
            if let Ok(Ok(investments)) = result {
                for inv in investments {
                    if inv.amount == 0.0 {
                        continue;
                    }
                    let inv_type = inv.investment_type.unwrap_or_default();
                    let due_date = inv
                        .due_date
                        .as_deref()
                        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
                    pluggy_positions.push(Position {
                        amount: inv.amount,
                        investment_type: inv_type,
                        rate: inv.rate,
                        rate_type: inv.rate_type,
                        fixed_annual_rate: inv.fixed_annual_rate,
                        due_date,
                    });
                }
            }
        }

        while let Some(result) = account_handles.join_next().await {
            if let Ok(Ok(accounts)) = result {
                accounts_balance += accounts.iter().map(|a| a.balance).sum::<f64>();
            }
        }
    }

    // Add manual positions
    for p in &manual_positions {
        let due_date = p
            .due_date
            .as_deref()
            .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
        pluggy_positions.push(Position {
            amount: p.amount,
            investment_type: p.investment_type.clone(),
            rate: None,
            rate_type: None,
            fixed_annual_rate: None,
            due_date,
        });
    }

    let today = chrono::Utc::now().date_naive();

    // Run projection
    let params = ProjectionParams {
        positions: pluggy_positions,
        accounts_balance,
        cdi_annual: body.cdi_annual,
        ipca_annual: body.ipca_annual,
        gross_salary: body.gross_salary,
        avg_monthly_expenses: body.avg_monthly_expenses,
        other_deductions: body.other_deductions,
        thirteenth_received: body.thirteenth_received,
        vacation_third_received: body.vacation_third_received,
        compound_savings: body.compound_savings,
    };

    let projection = projections::project_net_worth(&params, today);

    // Compute tax breakdown
    let monthly_income = if body.gross_salary > 0.0 {
        Some(taxes::calculate_monthly_income(
            body.gross_salary,
            body.other_deductions,
        ))
    } else {
        None
    };

    let annual_bonuses = if body.gross_salary > 0.0 {
        Some(taxes::calculate_annual_bonuses(body.gross_salary))
    } else {
        None
    };

    // Summary
    let current_total = projection.first().map(|p| p.total).unwrap_or(0.0);
    let december_key = format!("{}-12", today.year());
    let december_point = projection.iter().find(|p| p.month == december_key);
    let end_of_year_total = december_point
        .or(projection.last())
        .map(|p| p.total)
        .unwrap_or(0.0);
    let end_of_year_label = december_point
        .or(projection.last())
        .map(|p| p.label.clone())
        .unwrap_or_default();
    let growth_percentage = if current_total > 0.0 {
        ((end_of_year_total - current_total) / current_total) * 100.0
    } else {
        0.0
    };
    let monthly_surplus = monthly_income
        .as_ref()
        .map(|i| i.net_income - body.avg_monthly_expenses)
        .unwrap_or(0.0);

    // Income schedule
    let income_schedule = if body.gross_salary > 0.0 {
        let start_month = today.month0();
        let year = today.year();
        (start_month..12)
            .map(|m| {
                let income = taxes::calculate_monthly_income(body.gross_salary, body.other_deductions);
                let note = if m == 11 {
                    "+ 13th & vacation 1/3".to_string()
                } else {
                    String::new()
                };
                IncomeScheduleRow {
                    month: format!("{} {}", MONTH_NAMES[m as usize], year),
                    month_idx: m,
                    gross: income.gross_before_tax,
                    inss: income.inss,
                    irrf: income.irrf,
                    other_deductions: income.other_deductions,
                    net: income.net_income,
                    note,
                }
            })
            .collect()
    } else {
        vec![]
    };

    Ok(Json(ProjectionsComputeResponse {
        monthly_income,
        annual_bonuses,
        projection,
        summary: ProjectionSummary {
            current_total,
            end_of_year_total,
            end_of_year_label,
            growth_percentage,
            monthly_surplus,
        },
        income_schedule,
    }))
}
