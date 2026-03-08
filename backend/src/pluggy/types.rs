use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct PluggyAuthRequest {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "clientSecret")]
    pub client_secret: String,
}

#[derive(Deserialize)]
pub struct PluggyAuthResponse {
    #[serde(rename = "apiKey")]
    pub api_key: String,
}

#[derive(Deserialize)]
pub struct PluggyAccount {
    #[serde(default)]
    pub balance: f64,
    #[serde(default)]
    pub subtype: Option<String>,
    #[serde(rename = "currencyCode", default)]
    pub currency_code: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Deserialize)]
pub struct PluggyAccountsResponse {
    pub results: Vec<PluggyAccount>,
}

#[derive(Deserialize)]
pub struct PluggyConnectTokenResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
}

#[derive(Deserialize)]
pub struct PluggyConnector {
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Deserialize)]
pub struct PluggyItemResponse {
    #[serde(default)]
    pub connector: Option<PluggyConnector>,
}
