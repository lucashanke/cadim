pub mod accounts;
pub mod connect_token;
pub mod credit_cards;
pub mod health;
pub mod investments;
pub mod items;
pub mod rates;
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
        .route("/api/accounts/summary", get(accounts::accounts_summary_multi))
        .route("/api/accounts/{item_id}/summary", get(accounts::accounts_summary))
        .route("/api/investments/summary", get(investments::investments_summary_multi))
        .route("/api/investments/{item_id}/summary", get(investments::investments_summary))
        .route("/api/investments/{item_id}/list", get(investments::investments_list))
        .route("/api/credit-cards/{item_id}/list", get(credit_cards::credit_cards_list))
        .route("/api/transactions/{account_id}", get(credit_cards::transactions_list))
        .route("/api/transactions/{account_id}/cycles", get(credit_cards::transactions_cycles))
        .route("/api/items/{item_id}", get(items::get_item_info))
        .route("/api/rates", get(rates::get_rates))
        .route("/api/accounts/expenses", get(accounts::average_expenses_multi))
        .route("/api/items/{item_id}", delete(items::delete_item))
        .layer(cors)
        .with_state(state)
}
