use std::sync::Arc;
use axum::{extract::{Path, State}, Json};
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
