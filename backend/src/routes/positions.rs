use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use crate::auth::middleware::AuthUser;
use crate::db::positions::{self, CreatePosition, UpdatePosition};
use crate::error::AppError;
use crate::state::AppState;

pub async fn create(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreatePosition>,
) -> Result<(StatusCode, Json<positions::Position>), AppError> {
    let position =
        positions::create_position(&state.db, &auth.id, &body, &auth.encryption_key).await?;
    Ok((StatusCode::CREATED, Json(position)))
}

pub async fn update(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePosition>,
) -> Result<Json<positions::Position>, AppError> {
    let position =
        positions::update_position(&state.db, &id, &auth.id, &body, &auth.encryption_key).await?;
    Ok(Json(position))
}

pub async fn delete(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    positions::delete_position(&state.db, &id, &auth.id).await?;
    Ok(StatusCode::NO_CONTENT)
}
