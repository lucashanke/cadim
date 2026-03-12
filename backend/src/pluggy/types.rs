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
}

#[derive(Deserialize)]
pub struct PluggyAccountsResponse {
    pub results: Vec<PluggyAccount>,
}

#[derive(Deserialize)]
pub struct PluggyInvestment {
    pub id: String,
    pub name: Option<String>,
    #[serde(rename = "type", default)]
    pub investment_type: Option<String>,
    #[serde(default)]
    pub subtype: Option<String>,
    #[serde(default)]
    pub amount: f64,
    #[serde(rename = "currencyCode", default)]
    pub currency_code: Option<String>,
    pub date: Option<String>,
    #[serde(rename = "dueDate", default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub rate: Option<f64>,
    #[serde(rename = "rateType", default)]
    pub rate_type: Option<String>,
    #[serde(rename = "fixedAnnualRate", default)]
    pub fixed_annual_rate: Option<f64>,
}

#[derive(Deserialize)]
pub struct PluggyInvestmentsResponse {
    pub results: Vec<PluggyInvestment>,
}

#[derive(Deserialize)]
pub struct PluggyCardCreditData {
    #[serde(rename = "creditLimit", default)]
    pub credit_limit: Option<f64>,
    #[serde(rename = "availableCreditLimit", default)]
    pub available_credit_limit: Option<f64>,
    #[serde(rename = "billDueDate", default)]
    pub bill_due_date: Option<String>,
    #[serde(rename = "minimumPayment", default)]
    pub minimum_payment: Option<f64>,
}

#[derive(Deserialize)]
pub struct PluggyCardAccount {
    pub id: String,
    pub name: Option<String>,
    #[serde(default)]
    pub balance: f64,
    #[serde(rename = "currencyCode", default)]
    pub currency_code: Option<String>,
    #[serde(rename = "creditData", default)]
    pub credit_data: Option<PluggyCardCreditData>,
}

#[derive(Deserialize)]
pub struct PluggyCardAccountsResponse {
    pub results: Vec<PluggyCardAccount>,
}

#[derive(Deserialize)]
pub struct PluggyTransaction {
    pub id: String,
    pub description: String,
    #[serde(default)]
    pub amount: f64,
    #[serde(rename = "currencyCode", default)]
    pub currency_code: Option<String>,
    pub date: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(rename = "amountInAccountCurrency", default)]
    pub amount_in_account_currency: Option<f64>,
    #[serde(rename = "type")]
    pub transaction_type: String,
}

#[derive(Deserialize)]
pub struct PluggyTransactionsResponse {
    pub results: Vec<PluggyTransaction>,
    pub total: usize,
    #[serde(rename = "totalPages")]
    pub total_pages: usize,
    pub page: usize,
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
