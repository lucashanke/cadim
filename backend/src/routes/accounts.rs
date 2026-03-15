use std::sync::Arc;
use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use crate::{state::AppState, error::AppError};
use super::types::AccountsSummary;

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
