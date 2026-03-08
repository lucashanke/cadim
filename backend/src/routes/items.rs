use std::sync::Arc;
use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{state::AppState, error::AppError};
use super::types::ItemInfoResponse;

pub async fn get_item_info(
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
) -> Result<Json<ItemInfoResponse>, AppError> {
    let item = state.pluggy_client.get_item_info(&item_id).await?;

    let connector_name = item
        .connector
        .and_then(|c| c.name)
        .unwrap_or_else(|| "Unknown".to_string());

    Ok(Json(ItemInfoResponse {
        id: item_id,
        connector_name,
    }))
}

pub async fn delete_item(
    State(state): State<Arc<AppState>>,
    Path(item_id): Path<String>,
) -> Result<StatusCode, AppError> {
    state.pluggy_client.delete_item(&item_id).await?;

    Ok(StatusCode::NO_CONTENT)
}
