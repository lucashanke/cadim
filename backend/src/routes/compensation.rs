use axum::{extract::State, Json};
use std::sync::Arc;

use crate::auth::middleware::AuthUser;
use crate::db::compensation::{self, CompensationConfig};
use crate::error::AppError;
use crate::state::AppState;

pub async fn get_config(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Option<CompensationConfig>>, AppError> {
    let config = compensation::get_config(&state.db, &auth.id, &auth.encryption_key).await?;
    Ok(Json(config))
}

pub async fn upsert_config(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<CompensationConfig>,
) -> Result<Json<serde_json::Value>, AppError> {
    compensation::upsert_config(&state.db, &auth.id, &body, &auth.encryption_key).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}
