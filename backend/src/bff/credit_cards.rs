use std::sync::Arc;
use axum::{extract::State, Json};
use chrono::Datelike;
use serde::Serialize;
use tokio::task::JoinSet;

use crate::{
    auth::middleware::AuthUser,
    db::pluggy_items,
    domain::spending::{
        self, merge_billing_cycles, spending_history, spending_trend, BillingCycle,
        SpendingHistory, SpendingTrend, TransactionItem,
    },
    error::AppError,
    pluggy::types::PluggyTransaction,
    state::AppState,
};

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

#[derive(Debug, Serialize)]
pub struct BffCreditCard {
    pub id: String,
    pub name: String,
    pub balance: f64,
    pub currency_code: String,
    pub credit_limit: Option<f64>,
    pub available_credit_limit: Option<f64>,
    pub bill_due_date: Option<String>,
    pub minimum_payment: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct BffCreditCardsErrors {
    pub credit_cards: Option<String>,
    pub billing_cycles: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BffCreditCardsResponse {
    pub credit_cards: Vec<BffCreditCard>,
    pub billing_cycles: Vec<BillingCycle>,
    pub spending_history: Option<SpendingHistory>,
    pub spending_trend: Option<SpendingTrend>,
    pub errors: BffCreditCardsErrors,
}

pub async fn credit_cards(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<BffCreditCardsResponse>, AppError> {
    let items = pluggy_items::list_items(&state.db, &auth.id).await?;

    let mut cards_error: Option<String> = None;
    let mut cycles_error: Option<String> = None;
    let mut all_cards = Vec::new();
    let mut all_card_cycles: Vec<Vec<BillingCycle>> = Vec::new();

    if !items.is_empty() {
        // Fetch credit card accounts from all items in parallel
        let mut card_handles = JoinSet::new();
        for item in &items {
            let st = state.clone();
            let item_id = item.pluggy_item_id.clone();
            card_handles.spawn(async move {
                st.pluggy_client.get_credit_card_accounts(&item_id).await
            });
        }

        while let Some(result) = card_handles.join_next().await {
            match result {
                Ok(Ok(accounts)) => {
                    for a in accounts {
                        all_cards.push(BffCreditCard {
                            id: a.id,
                            name: a.name.unwrap_or_default(),
                            balance: a.balance,
                            currency_code: a
                                .currency_code
                                .unwrap_or_else(|| "BRL".to_string()),
                            credit_limit: a.credit_data.as_ref().and_then(|c| c.credit_limit),
                            available_credit_limit: a
                                .credit_data
                                .as_ref()
                                .and_then(|c| c.available_credit_limit),
                            bill_due_date: a
                                .credit_data
                                .as_ref()
                                .and_then(|c| c.bill_due_date.clone()),
                            minimum_payment: a
                                .credit_data
                                .as_ref()
                                .and_then(|c| c.minimum_payment),
                        });
                    }
                }
                Ok(Err(e)) => cards_error = Some(e.to_string()),
                Err(e) => cards_error = Some(e.to_string()),
            }
        }

        // Compute date window: 5 months back to end of next month
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

        // Fetch billing cycles for all cards in parallel
        if !all_cards.is_empty() {
            let mut cycle_handles = JoinSet::new();
            for card in &all_cards {
                let st = state.clone();
                let account_id = card.id.clone();
                let from = window_from.clone();
                let to = window_to.clone();
                cycle_handles.spawn(async move {
                    let transactions = st
                        .pluggy_client
                        .get_all_transactions(&account_id, Some(&from), Some(&to))
                        .await?;
                    Ok::<Vec<BillingCycle>, AppError>(build_cycles(transactions))
                });
            }

            while let Some(result) = cycle_handles.join_next().await {
                match result {
                    Ok(Ok(card_cycles)) => all_card_cycles.push(card_cycles),
                    Ok(Err(e)) => cycles_error = Some(e.to_string()),
                    Err(e) => cycles_error = Some(e.to_string()),
                }
            }
        }
    }

    // Merge cycles across all cards
    let merged_cycles = merge_billing_cycles(all_card_cycles);

    // Compute spending analytics
    let history = spending_history(&merged_cycles, 10);
    let trend = spending_trend(&merged_cycles);

    Ok(Json(BffCreditCardsResponse {
        credit_cards: all_cards,
        billing_cycles: merged_cycles,
        spending_history: history,
        spending_trend: trend,
        errors: BffCreditCardsErrors {
            credit_cards: cards_error,
            billing_cycles: cycles_error,
        },
    }))
}
