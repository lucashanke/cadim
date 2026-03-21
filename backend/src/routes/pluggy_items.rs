use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use crate::auth::middleware::AuthUser;
use crate::db::pluggy_items::{self, CreatePluggyItem, PluggyItem};
use crate::error::AppError;
use crate::state::AppState;

pub async fn create(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreatePluggyItem>,
) -> Result<(StatusCode, Json<PluggyItem>), AppError> {
    let item = pluggy_items::create_item(&state.db, &auth.id, &body).await?;
    Ok((StatusCode::CREATED, Json(item)))
}

pub async fn delete(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(pluggy_item_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    pluggy_items::delete_item(&state.db, &pluggy_item_id, &auth.id).await?;
    Ok(StatusCode::NO_CONTENT)
}
