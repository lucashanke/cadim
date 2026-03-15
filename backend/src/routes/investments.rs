use std::sync::Arc;
use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
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

#[derive(Deserialize)]
pub struct MultiItemQuery {
    pub item_ids: String,
}

pub async fn investments_summary_multi(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MultiItemQuery>,
) -> Result<Json<InvestmentsSummary>, AppError> {
    let item_ids: Vec<String> = params
        .item_ids
        .split(',')
        .map(|s| s.to_string())
        .collect();

    let mut handles = tokio::task::JoinSet::new();
    for item_id in item_ids {
        let state = state.clone();
        handles.spawn(async move {
            state.pluggy_client.get_investments(&item_id).await
        });
    }

    let mut total_gross_amount = 0.0f64;
    let mut investment_count = 0usize;
    let mut currency_code = "BRL".to_string();
    let mut first = true;

    while let Some(result) = handles.join_next().await {
        let investments = result.map_err(|e| AppError::Internal(e.to_string()))??;
        total_gross_amount += investments.iter().map(|i| i.amount).sum::<f64>();
        investment_count += investments.len();
        if first {
            if let Some(cc) = investments.first().and_then(|i| i.currency_code.clone()) {
                currency_code = cc;
            }
            first = false;
        }
    }

    Ok(Json(InvestmentsSummary {
        total_gross_amount,
        currency_code,
        investment_count,
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
