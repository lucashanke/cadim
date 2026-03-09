pub mod accounts;
pub mod connect_token;
pub mod health;
pub mod investments;
pub mod items;
pub mod types;

use std::sync::Arc;
use axum::{routing::{get, post, delete}, Router};
use tower_http::cors::CorsLayer;
use crate::state::AppState;

pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::permissive();

    Router::new()
        .route("/api/health", get(health::health))
        .route("/api/connect-token", post(connect_token::create_connect_token))
        .route("/api/accounts/{item_id}/summary", get(accounts::accounts_summary))
        .route("/api/investments/{item_id}/summary", get(investments::investments_summary))
        .route("/api/investments/{item_id}/list", get(investments::investments_list))
        .route("/api/items/{item_id}", get(items::get_item_info))
        .route("/api/items/{item_id}", delete(items::delete_item))
        .layer(cors)
        .with_state(state)
}
