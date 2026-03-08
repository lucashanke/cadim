use axum::Json;
use super::types::HealthResponse;

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        message: "cadim backend is running".to_string(),
    })
}
