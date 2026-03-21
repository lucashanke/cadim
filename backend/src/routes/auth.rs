use axum::{extract::State, Json};
use axum::http::header::SET_COOKIE;
use axum::response::IntoResponse;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::auth::jwt;
use crate::db::users;
use crate::error::AppError;
use crate::state::AppState;
use crate::auth::middleware::AuthUser;

#[derive(Deserialize)]
pub struct AuthRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub id: String,
    pub email: String,
}

fn make_cookie(token: &str, is_production: bool) -> String {
    let secure = if is_production { "; Secure" } else { "" };
    format!(
        "cadim_token={}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600{}",
        token, secure
    )
}

fn clear_cookie(is_production: bool) -> String {
    let secure = if is_production { "; Secure" } else { "" };
    format!(
        "cadim_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0{}",
        secure
    )
}

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AuthRequest>,
) -> Result<impl IntoResponse, AppError> {
    let email = body.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(AppError::BadRequest("Invalid email".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    let user = users::create_user(&state.db, &email, &body.password).await?;
    let token = jwt::create_token(&user.id, &state.jwt_secret)?;
    let is_production = std::env::var("APP_ENV").as_deref() == Ok("production");

    Ok((
        [(SET_COOKIE, make_cookie(&token, is_production))],
        Json(AuthResponse {
            id: user.id,
            email: user.email,
        }),
    ))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(body): Json<AuthRequest>,
) -> Result<impl IntoResponse, AppError> {
    let email = body.email.trim().to_lowercase();

    let user = users::find_by_email(&state.db, &email)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

    let valid = users::verify_password(&body.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    }

    let token = jwt::create_token(&user.id, &state.jwt_secret)?;
    let is_production = std::env::var("APP_ENV").as_deref() == Ok("production");

    Ok((
        [(SET_COOKIE, make_cookie(&token, is_production))],
        Json(AuthResponse {
            id: user.id,
            email: user.email,
        }),
    ))
}

pub async fn logout() -> impl IntoResponse {
    let is_production = std::env::var("APP_ENV").as_deref() == Ok("production");
    (
        [(SET_COOKIE, clear_cookie(is_production))],
        Json(serde_json::json!({"ok": true})),
    )
}

pub async fn me(auth: AuthUser) -> Result<Json<AuthResponse>, AppError> {
    // The AuthUser extractor already validated the token - but we need email
    // For simplicity, we'll just return the ID. The frontend mainly needs to know if authenticated.
    Ok(Json(AuthResponse {
        id: auth.id,
        email: String::new(), // Not stored in JWT, frontend doesn't need it for auth check
    }))
}
