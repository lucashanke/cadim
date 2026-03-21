pub mod accounts;
pub mod auth;
pub mod compensation;
pub mod connect_token;
pub mod credit_cards;
pub mod health;
pub mod investments;
pub mod items;
pub mod pluggy_items;
pub mod positions;
pub mod rates;
pub mod types;

use std::sync::Arc;
use axum::{routing::{get, post, put, delete}, Router};
use tower_http::cors::{CorsLayer, AllowOrigin, AllowHeaders, AllowMethods};
use axum::http::{HeaderName, Method};
use crate::state::AppState;

pub fn build_router(state: Arc<AppState>) -> Router {
    let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173".into());

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(frontend_url.parse().unwrap()))
        .allow_methods(AllowMethods::list([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ]))
        .allow_headers(AllowHeaders::list([
            HeaderName::from_static("content-type"),
        ]))
        .allow_credentials(true);

    Router::new()
        // Public routes
        .route("/api/health", get(health::health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/me", get(auth::me))
        // Protected routes (AuthUser extractor handles auth)
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
        // New data routes (protected via AuthUser extractor)
        .route("/api/positions", get(positions::list).post(positions::create))
        .route("/api/positions/{id}", put(positions::update).delete(positions::delete))
        .route("/api/compensation-config", get(compensation::get_config).put(compensation::upsert_config))
        .route("/api/pluggy-items", get(pluggy_items::list).post(pluggy_items::create))
        .route("/api/pluggy-items/{pluggy_item_id}", delete(pluggy_items::delete))
        .layer(cors)
        .with_state(state)
}
