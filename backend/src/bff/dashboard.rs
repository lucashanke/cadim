use std::sync::Arc;
use axum::{extract::State, Json};
use chrono::Datelike;
use serde::Serialize;
use tokio::task::JoinSet;

use crate::{
    auth::middleware::AuthUser,
    db::{pluggy_items, positions},
    domain::{
        investments::{investment_type_label, subtype_label},
        portfolio::{
            attention_items, net_worth_composition, portfolio_allocation, AttentionItem,
            AllocationEntry, CompositionSegment, PortfolioPosition,
        },
        spending::{self, merge_billing_cycles, spending_trend, BillingCycle, SpendingTrend, TransactionItem},
    },
    error::AppError,
    pluggy::types::PluggyTransaction,
    state::AppState,
};

// ── Response types ────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct NetWorth {
    pub total: f64,
    pub accounts_balance: f64,
    pub investments_total: f64,
    pub currency_code: String,
}

#[derive(Debug, Serialize)]
pub struct AccountsSummary {
    pub total_balance: f64,
    pub account_count: usize,
    pub currency_code: String,
}

#[derive(Debug, Serialize)]
pub struct InvestmentsSummary {
    pub total_gross_amount: f64,
    pub investment_count: usize,
    pub currency_code: String,
}

#[derive(Debug, Serialize)]
pub struct Composition {
    pub total: f64,
    pub segments: Vec<CompositionSegment>,
}

#[derive(Debug, Serialize)]
pub struct Allocation {
    pub entries: Vec<AllocationEntry>,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct DashboardErrors {
    pub accounts: Option<String>,
    pub investments: Option<String>,
    pub credit_cards: Option<String>,
    pub billing_cycles: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BffDashboardResponse {
    pub net_worth: NetWorth,
    pub accounts: Option<AccountsSummary>,
    pub investments: Option<InvestmentsSummary>,
    pub composition: Option<Composition>,
    pub allocation: Option<Allocation>,
    pub attention_items: Vec<AttentionItem>,
    pub spending_trend: Option<SpendingTrend>,
    pub errors: DashboardErrors,
}

// ── Helpers (shared with credit_cards.rs) ─────────────────────────────

const PT_BR_MONTHS: [&str; 12] = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
];

fn cycle_label(key: &str) -> String {
    let mut parts = key.splitn(2, '-');
    let year = parts.next().unwrap_or("");
    let month: usize = parts.next().and_then(|m| m.parse().ok()).unwrap_or(1);
    let abbr = PT_BR_MONTHS[month.saturating_sub(1).min(11)];
    format!("{} {}", abbr, year)
}

fn map_pluggy_transaction(t: PluggyTransaction) -> TransactionItem {
    let card_last_four = t
        .credit_card_metadata
        .as_ref()
        .and_then(|m| m.card_number.as_deref())
        .map(|n| {
            n.chars()
                .rev()
                .take(4)
                .collect::<String>()
                .chars()
                .rev()
                .collect()
        });
    let resolved_amount = match t.amount_in_account_currency {
        Some(aia) => t.amount.signum() * aia,
        None => t.amount,
    };
    TransactionItem {
        id: t.id,
        description: t.description,
        amount: t.amount,
        amount_in_account_currency: t.amount_in_account_currency,
        currency_code: t.currency_code.unwrap_or_else(|| "BRL".to_string()),
        date: t.date,
        category: t.category,
        transaction_type: t.transaction_type,
        card_last_four,
        resolved_amount,
    }
}

fn build_cycles(transactions: Vec<PluggyTransaction>) -> Vec<BillingCycle> {
    let items: Vec<TransactionItem> = transactions.into_iter().map(map_pluggy_transaction).collect();

    let mut by_month: std::collections::BTreeMap<String, Vec<TransactionItem>> =
        std::collections::BTreeMap::new();
    for item in items {
        let key: String = item.date.chars().take(7).collect();
        by_month.entry(key).or_default().push(item);
    }

    by_month
        .into_iter()
        .rev()
        .map(|(key, mut txns)| {
            txns.sort_by(|a, b| b.date.cmp(&a.date));

            let total: f64 = txns
                .iter()
                .filter(|t| {
                    t.category.as_deref() != Some("Credit card payment")
                        && t.category.as_deref() != Some("Transfers")
                })
                .map(|t| t.resolved_amount)
                .sum();

            let currency_code = txns
                .first()
                .map(|t| t.currency_code.clone())
                .unwrap_or_else(|| "BRL".to_string());

            let categories = spending::compute_categories(&txns);

            BillingCycle {
                label: cycle_label(&key),
                key,
                total,
                currency_code,
                transactions: txns,
                categories,
            }
        })
        .collect()
}

// ── Handler ───────────────────────────────────────────────────────────

pub async fn dashboard(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<BffDashboardResponse>, AppError> {
    // Fetch pluggy items and manual positions in parallel
    let (items_result, manual_result) = tokio::join!(
        pluggy_items::list_items(&state.db, &auth.id),
        positions::list_positions(&state.db, &auth.id, &auth.encryption_key),
    );

    let items = items_result?;
    let manual_positions = manual_result?;

    let mut accounts_error: Option<String> = None;
    let mut investments_error: Option<String> = None;
    let mut cards_error: Option<String> = None;
    let mut cycles_error: Option<String> = None;

    let mut accounts_balance = 0.0f64;
    let mut account_count = 0usize;
    let mut accounts_currency = "BRL".to_string();
    let mut has_accounts = false;

    let mut pluggy_positions = Vec::new();
    let mut all_credit_cards = Vec::new();

    if !items.is_empty() {
        // Parallel: accounts, investments, credit cards
        let mut account_handles = JoinSet::new();
        let mut invest_handles = JoinSet::new();
        let mut card_handles = JoinSet::new();

        for item in &items {
            let st = state.clone();
            let item_id = item.pluggy_item_id.clone();
            account_handles.spawn(async move {
                st.pluggy_client.get_checking_accounts(&item_id).await
            });

            let st = state.clone();
            let item_id = item.pluggy_item_id.clone();
            invest_handles.spawn(async move {
                st.pluggy_client.get_investments(&item_id).await
            });

            let st = state.clone();
            let item_id = item.pluggy_item_id.clone();
            card_handles.spawn(async move {
                st.pluggy_client.get_credit_card_accounts(&item_id).await
            });
        }

        // Collect accounts
        while let Some(result) = account_handles.join_next().await {
            match result {
                Ok(Ok(accounts)) => {
                    accounts_balance += accounts.iter().map(|a| a.balance).sum::<f64>();
                    account_count += accounts.len();
                    if !has_accounts {
                        if let Some(cc) = accounts.first().and_then(|a| a.currency_code.clone()) {
                            accounts_currency = cc;
                        }
                        has_accounts = true;
                    }
                }
                Ok(Err(e)) => accounts_error = Some(e.to_string()),
                Err(e) => accounts_error = Some(e.to_string()),
            }
        }

        // Collect investments
        while let Some(result) = invest_handles.join_next().await {
            match result {
                Ok(Ok(investments)) => pluggy_positions.extend(investments),
                Ok(Err(e)) => investments_error = Some(e.to_string()),
                Err(e) => investments_error = Some(e.to_string()),
            }
        }

        // Collect credit cards
        while let Some(result) = card_handles.join_next().await {
            match result {
                Ok(Ok(accounts)) => {
                    for a in accounts {
                        all_credit_cards.push(a.id.clone());
                    }
                }
                Ok(Err(e)) => cards_error = Some(e.to_string()),
                Err(e) => cards_error = Some(e.to_string()),
            }
        }
    }

    // Build portfolio positions (pluggy + manual)
    let mut portfolio_positions: Vec<PortfolioPosition> = pluggy_positions
        .iter()
        .filter(|i| i.amount != 0.0)
        .map(|i| {
            let inv_type = i.investment_type.clone().unwrap_or_default();
            let due_date = i
                .due_date
                .as_deref()
                .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
            PortfolioPosition {
                id: i.id.clone(),
                name: i.name.clone().unwrap_or_default(),
                investment_type: inv_type,
                subtype: i.subtype.clone(),
                amount: i.amount,
                due_date,
                is_manual: false,
            }
        })
        .collect();

    for p in &manual_positions {
        let name = p
            .subtype
            .as_deref()
            .map(subtype_label)
            .unwrap_or_else(|| investment_type_label(&p.investment_type).to_string());
        let due_date = p
            .due_date
            .as_deref()
            .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
        portfolio_positions.push(PortfolioPosition {
            id: p.id.clone(),
            name,
            investment_type: p.investment_type.clone(),
            subtype: p.subtype.clone(),
            amount: p.amount,
            due_date,
            is_manual: true,
        });
    }

    let investments_total: f64 = portfolio_positions.iter().map(|p| p.amount).sum();
    let investment_count = portfolio_positions.len();
    let today = chrono::Utc::now().date_naive();

    // Compute domain aggregations
    let composition = net_worth_composition(accounts_balance, &portfolio_positions)
        .map(|c| Composition {
            total: c.total,
            segments: c.segments,
        });

    let alloc = portfolio_allocation(&portfolio_positions);
    let allocation = if alloc.is_empty() {
        None
    } else {
        let total: f64 = alloc.iter().map(|e| e.amount).sum();
        Some(Allocation {
            entries: alloc,
            total,
        })
    };

    let attention = attention_items(&portfolio_positions, today);

    // Fetch billing cycles for spending trend
    let mut spending_trend_result: Option<SpendingTrend> = None;
    if !all_credit_cards.is_empty() {
        let now = chrono::Utc::now().date_naive();
        let five_months_ago = now - chrono::Months::new(5);
        let window_from = chrono::NaiveDate::from_ymd_opt(
            five_months_ago.year(),
            five_months_ago.month(),
            1,
        )
        .unwrap()
        .format("%Y-%m-%d")
        .to_string();

        let next_month = now + chrono::Months::new(1);
        let first_of_month_after =
            chrono::NaiveDate::from_ymd_opt(next_month.year(), next_month.month(), 1).unwrap();
        let window_to = (first_of_month_after - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();

        let mut cycle_handles = JoinSet::new();
        for account_id in &all_credit_cards {
            let st = state.clone();
            let aid = account_id.clone();
            let from = window_from.clone();
            let to = window_to.clone();
            cycle_handles.spawn(async move {
                let transactions = st
                    .pluggy_client
                    .get_all_transactions(&aid, Some(&from), Some(&to))
                    .await?;
                Ok::<Vec<BillingCycle>, AppError>(build_cycles(transactions))
            });
        }

        let mut all_card_cycles: Vec<Vec<BillingCycle>> = Vec::new();
        while let Some(result) = cycle_handles.join_next().await {
            match result {
                Ok(Ok(card_cycles)) => all_card_cycles.push(card_cycles),
                Ok(Err(e)) => cycles_error = Some(e.to_string()),
                Err(e) => cycles_error = Some(e.to_string()),
            }
        }

        let merged = merge_billing_cycles(all_card_cycles);
        spending_trend_result = spending_trend(&merged);
    }

    let net_worth_total = accounts_balance + investments_total;

    let accounts_summary = if has_accounts || accounts_balance > 0.0 {
        Some(AccountsSummary {
            total_balance: accounts_balance,
            account_count,
            currency_code: accounts_currency.clone(),
        })
    } else {
        None
    };

    let investments_summary = if investment_count > 0 {
        Some(InvestmentsSummary {
            total_gross_amount: investments_total,
            investment_count,
            currency_code: "BRL".to_string(),
        })
    } else {
        None
    };

    Ok(Json(BffDashboardResponse {
        net_worth: NetWorth {
            total: net_worth_total,
            accounts_balance,
            investments_total,
            currency_code: accounts_currency,
        },
        accounts: accounts_summary,
        investments: investments_summary,
        composition,
        allocation,
        attention_items: attention,
        spending_trend: spending_trend_result,
        errors: DashboardErrors {
            accounts: accounts_error,
            investments: investments_error,
            credit_cards: cards_error,
            billing_cycles: cycles_error,
        },
    }))
}
