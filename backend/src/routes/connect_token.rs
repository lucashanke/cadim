use std::sync::Arc;
use axum::{extract::State, Json};
use crate::{state::AppState, error::AppError};
use super::types::ConnectTokenResponse;

pub async fn create_connect_token(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ConnectTokenResponse>, AppError> {
    let access_token = state.pluggy_client.create_connect_token().await?;

    Ok(Json(ConnectTokenResponse { access_token }))
}
