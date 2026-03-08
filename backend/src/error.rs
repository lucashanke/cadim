use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::fmt;

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Debug)]
pub enum AppError {
    PluggyAuth(String),
    PluggyClient(String),
    PluggyServer { status: StatusCode, msg: String },
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PluggyAuth(msg) => write!(f, "Pluggy auth error: {}", msg),
            Self::PluggyClient(msg) => write!(f, "Pluggy client error: {}", msg),
            Self::PluggyServer { status, msg } => write!(f, "Pluggy server error ({}): {}", status, msg),
            Self::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

// Map AppError into an axum HTTP response
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::PluggyAuth(_) | AppError::PluggyServer { .. } | AppError::PluggyClient(_) => {
                // Return 502 for upstream Pluggy errors
                (StatusCode::BAD_GATEWAY, self.to_string())
            }
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        let body = Json(ErrorResponse {
            error: error_message,
        });

        (status, body).into_response()
    }
}
