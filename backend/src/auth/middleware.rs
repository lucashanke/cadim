use axum::{extract::FromRequestParts, http::request::Parts};
use std::sync::Arc;

use super::jwt;
use crate::{db::crypto, error::AppError, state::AppState};

/// Extractor that validates the JWT from the `cadim_token` cookie
/// and provides the authenticated user's ID and derived encryption key.
pub struct AuthUser {
    pub id: String,
    pub encryption_key: [u8; 32],
}

impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        // Extract cookie header manually to avoid extra dependencies
        let cookie_header = parts
            .headers
            .get(axum::http::header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Not authenticated".into()))?;

        // Parse cadim_token from cookie header
        let token = cookie_header
            .split(';')
            .filter_map(|s| {
                let s = s.trim();
                s.strip_prefix("cadim_token=")
            })
            .next()
            .ok_or_else(|| AppError::Unauthorized("Not authenticated".into()))?;

        let claims = jwt::validate_token(token, &state.jwt_secret)?;

        // Fetch user's encryption salt to derive their key
        let row = sqlx::query_as::<_, (Vec<u8>,)>(
            "SELECT encryption_salt FROM users WHERE id = ?",
        )
        .bind(&claims.sub)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch user: {}", e)))?
        .ok_or_else(|| AppError::Unauthorized("User not found".into()))?;

        let encryption_key = crypto::derive_user_key(&state.encryption_master_key, &row.0);

        Ok(AuthUser {
            id: claims.sub,
            encryption_key,
        })
    }
}
