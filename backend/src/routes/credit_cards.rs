use std::sync::Arc;
use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use crate::{state::AppState, error::AppError};
use crate::pluggy::types::PluggyTransaction;
use super::types::{BillingCycle, CategoryTotal, CreditCardAccount, TransactionItem, TransactionsResponse};

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

fn extract_card_last_four(card_number: Option<&str>) -> Option<String> {
    card_number.map(|n| n.chars().rev().take(4).collect::<String>().chars().rev().collect())
}

fn map_transaction(t: PluggyTransaction) -> TransactionItem {
    let card_last_four = extract_card_last_four(
        t.credit_card_metadata.as_ref().and_then(|m| m.card_number.as_deref()),
    );
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

pub async fn credit_cards_list(
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
) -> Result<Json<Vec<CreditCardAccount>>, AppError> {
    let accounts = state.pluggy_client.get_credit_card_accounts(&item_id).await?;
    let result = accounts
        .into_iter()
        .map(|a| CreditCardAccount {
            id: a.id,
            name: a.name.unwrap_or_default(),
            balance: a.balance,
            currency_code: a.currency_code.unwrap_or_else(|| "BRL".to_string()),
            credit_limit: a.credit_data.as_ref().and_then(|c| c.credit_limit),
            available_credit_limit: a.credit_data.as_ref().and_then(|c| c.available_credit_limit),
            bill_due_date: a.credit_data.as_ref().and_then(|c| c.bill_due_date.clone()),
            minimum_payment: a.credit_data.as_ref().and_then(|c| c.minimum_payment),
        })
        .collect();
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct TransactionsQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub from: Option<String>,
    pub to: Option<String>,
}

pub async fn transactions_list(
    State(state): State<Arc<AppState>>,
    Path(account_id): Path<String>,
    Query(params): Query<TransactionsQuery>,
) -> Result<Json<TransactionsResponse>, AppError> {
    let page = params.page.unwrap_or(1);
    let page_size = params.page_size.unwrap_or(20);
    let resp = state.pluggy_client
        .get_transactions(&account_id, page, page_size, params.from.as_deref(), params.to.as_deref())
        .await?;
    let result = TransactionsResponse {
        results: resp.results.into_iter().map(map_transaction).collect(),
        total: resp.total,
        total_pages: resp.total_pages,
        page: resp.page,
    };
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct CyclesQuery {
    pub from: Option<String>,
    pub to: Option<String>,
}

pub async fn transactions_cycles(
    State(state): State<Arc<AppState>>,
    Path(account_id): Path<String>,
    Query(params): Query<CyclesQuery>,
) -> Result<Json<Vec<BillingCycle>>, AppError> {
    let transactions = state.pluggy_client
        .get_all_transactions(&account_id, params.from.as_deref(), params.to.as_deref())
        .await?;

    let items: Vec<TransactionItem> = transactions.into_iter().map(map_transaction).collect();

    let mut by_month: std::collections::BTreeMap<String, Vec<TransactionItem>> =
        std::collections::BTreeMap::new();
    for item in items {
        let key: String = item.date.chars().take(7).collect();
        by_month.entry(key).or_default().push(item);
    }

    let cycles: Vec<BillingCycle> = by_month
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

            let mut cat_map: std::collections::HashMap<String, f64> =
                std::collections::HashMap::new();
            for t in &txns {
                if t.category.as_deref() == Some("Credit card payment")
                    || t.category.as_deref() == Some("Transfers")
                {
                    continue;
                }
                let cat = t.category.clone().unwrap_or_else(|| "Unknown".to_string());
                *cat_map.entry(cat).or_default() += t.resolved_amount.abs();
            }
            let mut categories: Vec<CategoryTotal> = cat_map
                .into_iter()
                .map(|(name, amount)| CategoryTotal { name, amount })
                .collect();
            categories.sort_by(|a, b| {
                b.amount
                    .partial_cmp(&a.amount)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            BillingCycle {
                label: cycle_label(&key),
                key,
                total,
                currency_code,
                transactions: txns,
                categories,
            }
        })
        .collect();

    Ok(Json(cycles))
}
