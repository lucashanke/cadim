use std::collections::HashMap;
use std::sync::Arc;
use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use crate::{state::AppState, error::AppError};
use super::types::{AccountsSummary, AverageExpensesResponse, ExpenseTransaction, ExpenseMonthBreakdown};

pub async fn accounts_summary(
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
) -> Result<Json<AccountsSummary>, AppError> {
    let checking_accounts = state.pluggy_client.get_checking_accounts(&item_id).await?;

    let total_balance: f64 = checking_accounts.iter().map(|a| a.balance).sum();
    let currency_code = checking_accounts
        .first()
        .and_then(|a| a.currency_code.clone())
        .unwrap_or_else(|| "BRL".to_string());

    Ok(Json(AccountsSummary {
        total_balance,
        currency_code,
        account_count: checking_accounts.len(),
    }))
}

#[derive(Deserialize)]
pub struct MultiItemQuery {
    pub item_ids: String,
}

pub async fn accounts_summary_multi(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MultiItemQuery>,
) -> Result<Json<AccountsSummary>, AppError> {
    let item_ids: Vec<String> = params
        .item_ids
        .split(',')
        .map(|s| s.to_string())
        .collect();

    let mut handles = tokio::task::JoinSet::new();
    for item_id in item_ids {
        let state = state.clone();
        handles.spawn(async move {
            state.pluggy_client.get_checking_accounts(&item_id).await
        });
    }

    let mut total_balance = 0.0f64;
    let mut account_count = 0usize;
    let mut currency_code = "BRL".to_string();
    let mut first = true;

    while let Some(result) = handles.join_next().await {
        let accounts = result.map_err(|e| AppError::Internal(e.to_string()))??;
        total_balance += accounts.iter().map(|a| a.balance).sum::<f64>();
        account_count += accounts.len();
        if first {
            if let Some(cc) = accounts.first().and_then(|a| a.currency_code.clone()) {
                currency_code = cc;
            }
            first = false;
        }
    }

    Ok(Json(AccountsSummary {
        total_balance,
        currency_code,
        account_count,
    }))
}

const EXCLUDED_CATEGORIES: &[&str] = &[
    "Transfer",
    "Transfers",
    "Same ownership transfer",
    "Same person transfer",
    "Fixed income",
    "Investments",
];

pub async fn average_expenses_multi(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MultiItemQuery>,
) -> Result<Json<AverageExpensesResponse>, AppError> {
    let item_ids: Vec<String> = params
        .item_ids
        .split(',')
        .map(|s| s.to_string())
        .collect();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // Simple date math: ~182 days for 6 months
    let six_months_secs = 182 * 24 * 3600;
    let to_str = format_epoch_date(now);
    let from_str = format_epoch_date(now - six_months_secs);

    // Collect all checking account IDs
    let mut account_ids = Vec::new();
    for item_id in &item_ids {
        let accounts = state.pluggy_client.get_checking_accounts(item_id).await?;
        for account in accounts {
            account_ids.push(account.id);
        }
    }

    // Fetch all transactions for all checking accounts
    let mut monthly_data: HashMap<String, (f64, Vec<ExpenseTransaction>)> = HashMap::new();
    for account_id in &account_ids {
        let transactions = state
            .pluggy_client
            .get_all_transactions(account_id, Some(&from_str), Some(&to_str))
            .await?;

        for tx in transactions {
            // Only negative amounts (outflows)
            if tx.amount >= 0.0 {
                continue;
            }
            // Exclude certain categories
            if let Some(ref cat) = tx.category {
                if EXCLUDED_CATEGORIES.iter().any(|t| cat.eq_ignore_ascii_case(t)) {
                    continue;
                }
            }
            let abs_amount = tx.amount.abs();
            // Group by year-month
            let year_month = tx.date[..7].to_string();
            let entry = monthly_data.entry(year_month).or_insert_with(|| (0.0, Vec::new()));
            entry.0 += abs_amount;
            entry.1.push(ExpenseTransaction {
                description: tx.description,
                amount: (abs_amount * 100.0).round() / 100.0,
                date: tx.date,
                category: tx.category,
            });
        }
    }

    let months_analyzed = monthly_data.len();
    let total_expenses: f64 = monthly_data.values().map(|(t, _)| t).sum();
    let average = if months_analyzed > 0 {
        total_expenses / months_analyzed as f64
    } else {
        0.0
    };

    let mut monthly_breakdown: Vec<ExpenseMonthBreakdown> = monthly_data
        .into_iter()
        .map(|(month, (total, mut transactions))| {
            transactions.sort_by(|a, b| a.date.cmp(&b.date));
            ExpenseMonthBreakdown {
                month,
                total: (total * 100.0).round() / 100.0,
                transactions,
            }
        })
        .collect();
    monthly_breakdown.sort_by(|a, b| b.month.cmp(&a.month));

    Ok(Json(AverageExpensesResponse {
        average_monthly_expenses: (average * 100.0).round() / 100.0,
        currency_code: "BRL".to_string(),
        months_analyzed,
        monthly_breakdown,
    }))
}

fn format_epoch_date(epoch_secs: u64) -> String {
    const DAYS_PER_YEAR: u64 = 365;
    const SECS_PER_DAY: u64 = 86400;

    let mut days = epoch_secs / SECS_PER_DAY;
    let mut year = 1970u64;

    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let month_days: [u64; 12] = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 0u64;
    for (i, &md) in month_days.iter().enumerate() {
        if days < md {
            month = i as u64 + 1;
            break;
        }
        days -= md;
    }
    if month == 0 { month = 12; }
    let day = days + 1;

    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn is_leap(year: u64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}
