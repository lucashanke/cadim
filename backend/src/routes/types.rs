use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct ConnectTokenResponse {
    pub access_token: String,
}

#[derive(Serialize)]
pub struct ItemInfoResponse {
    pub id: String,
    pub connector_name: String,
}
