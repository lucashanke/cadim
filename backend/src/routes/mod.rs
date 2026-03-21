pub mod auth;
pub mod compensation;
pub mod connect_token;
pub mod health;
pub mod items;
pub mod pluggy_items;
pub mod positions;
pub mod types;

use std::sync::Arc;
use axum::{routing::{get, post, put, delete}, Router};
use tower_http::cors::{CorsLayer, AllowOrigin, AllowHeaders, AllowMethods};
use axum::http::{HeaderName, Method};
use crate::bff;
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
        .route("/api/items/{item_id}", get(items::get_item_info).delete(items::delete_item))
        // Data routes (protected via AuthUser extractor)
        .route("/api/positions", post(positions::create))
        .route("/api/positions/{id}", put(positions::update).delete(positions::delete))
        .route("/api/compensation-config", put(compensation::upsert_config))
        .route("/api/pluggy-items", post(pluggy_items::create))
        .route("/api/pluggy-items/{pluggy_item_id}", delete(pluggy_items::delete))
        // BFF endpoints
        .route("/api/bff/bootstrap", get(bff::bootstrap::bootstrap))
        .route("/api/bff/investments", get(bff::investments::investments))
        .route("/api/bff/credit-cards", get(bff::credit_cards::credit_cards))
        .route("/api/bff/dashboard", get(bff::dashboard::dashboard))
        .route("/api/bff/projections/config", get(bff::projections::config))
        .route("/api/bff/projections", post(bff::projections::compute))
        .layer(cors)
        .with_state(state)
}
