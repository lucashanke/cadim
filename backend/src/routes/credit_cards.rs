use std::sync::Arc;
use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use crate::{state::AppState, error::AppError};
use super::types::{CreditCardAccount, TransactionItem, TransactionsResponse};

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
    let resp = state.pluggy_client.get_transactions(&account_id, page, page_size, params.from.as_deref(), params.to.as_deref()).await?;
    let result = TransactionsResponse {
        results: resp.results
            .into_iter()
            .map(|t| {
                let card_last_four = t.credit_card_metadata
                    .as_ref()
                    .and_then(|m| m.card_number.as_deref())
                    .and_then(|n| n.chars().rev().take(4).collect::<String>().chars().rev().collect::<String>().into());
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
                }
            })
            .collect(),
        total: resp.total,
        total_pages: resp.total_pages,
        page: resp.page,
    };
    Ok(Json(result))
}
