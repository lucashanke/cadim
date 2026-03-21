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
    PluggyClient(String),
    PluggyServer { status: StatusCode, msg: String },
    Internal(String),
    Unauthorized(String),
    BadRequest(String),
    NotFound(String),
    Conflict(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PluggyClient(msg) => write!(f, "Pluggy client error: {}", msg),
            Self::PluggyServer { status, msg } => write!(f, "Pluggy server error ({}): {}", status, msg),
            Self::Internal(msg) => write!(f, "Internal error: {}", msg),
            Self::Unauthorized(msg) => write!(f, "{}", msg),
            Self::BadRequest(msg) => write!(f, "{}", msg),
            Self::NotFound(msg) => write!(f, "{}", msg),
            Self::Conflict(msg) => write!(f, "{}", msg),
        }
    }
}

// Map AppError into an axum HTTP response
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::PluggyServer { .. } | AppError::PluggyClient(_) => {
                // Return 502 for upstream Pluggy errors
                (StatusCode::BAD_GATEWAY, self.to_string())
            }
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::Conflict(_) => (StatusCode::CONFLICT, self.to_string()),
        };

        let body = Json(ErrorResponse {
            error: error_message,
        });

        (status, body).into_response()
    }
}
