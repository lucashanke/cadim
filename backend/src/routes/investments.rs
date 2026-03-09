use std::sync::Arc;
use axum::{extract::{Path, State}, Json};
use crate::{state::AppState, error::AppError};
use super::types::{InvestmentsSummary, InvestmentPosition};

pub async fn investments_summary(
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
) -> Result<Json<InvestmentsSummary>, AppError> {
    let investments = state.pluggy_client.get_investments(&item_id).await?;
    let total_gross_amount: f64 = investments.iter().map(|i| i.amount).sum();
    let currency_code = investments.first()
        .and_then(|i| i.currency_code.clone())
        .unwrap_or_else(|| "BRL".to_string());
    Ok(Json(InvestmentsSummary {
        total_gross_amount,
        currency_code,
        investment_count: investments.len(),
    }))
}

pub async fn investments_list(
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
) -> Result<Json<Vec<InvestmentPosition>>, AppError> {
    let investments = state.pluggy_client.get_investments(&item_id).await?;
    let positions = investments
        .into_iter()
        .filter(|i| i.amount != 0.0)
        .map(|i| InvestmentPosition {
            id: i.id,
            name: i.name.unwrap_or_default(),
            investment_type: i.investment_type.unwrap_or_default(),
            subtype: i.subtype,
            amount: i.amount,
            currency_code: i.currency_code.unwrap_or_else(|| "BRL".to_string()),
            date: i.date,
            due_date: i.due_date,
            rate: i.rate,
            rate_type: i.rate_type,
            fixed_annual_rate: i.fixed_annual_rate,
        })
        .collect();
    Ok(Json(positions))
}
