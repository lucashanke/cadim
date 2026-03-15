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
pub struct AccountsSummary {
    pub total_balance: f64,
    pub currency_code: String,
    pub account_count: usize,
}

#[derive(Serialize)]
pub struct InvestmentsSummary {
    pub total_gross_amount: f64,
    pub currency_code: String,
    pub investment_count: usize,
}

#[derive(Serialize)]
pub struct ItemInfoResponse {
    pub id: String,
    pub connector_name: String,
}

#[derive(Serialize)]
pub struct CreditCardAccount {
    pub id: String,
    pub name: String,
    pub balance: f64,
    pub currency_code: String,
    pub credit_limit: Option<f64>,
    pub available_credit_limit: Option<f64>,
    pub bill_due_date: Option<String>,
    pub minimum_payment: Option<f64>,
}

#[derive(Serialize)]
pub struct TransactionItem {
    pub id: String,
    pub description: String,
    pub amount: f64,
    pub currency_code: String,
    pub date: String,
    pub category: Option<String>,
    pub amount_in_account_currency: Option<f64>,
    pub resolved_amount: f64,
    pub transaction_type: String,
    pub card_last_four: Option<String>,
}

#[derive(Serialize)]
pub struct CategoryTotal {
    pub name: String,
    pub amount: f64,
}

#[derive(Serialize)]
pub struct BillingCycle {
    pub key: String,
    pub label: String,
    pub total: f64,
    pub currency_code: String,
    pub transactions: Vec<TransactionItem>,
    pub categories: Vec<CategoryTotal>,
}

#[derive(Serialize)]
pub struct TransactionsResponse {
    pub results: Vec<TransactionItem>,
    pub total: usize,
    pub total_pages: usize,
    pub page: usize,
}

#[derive(Serialize)]
pub struct InvestmentPosition {
    pub id: String,
    pub name: String,
    pub investment_type: String,
    pub subtype: Option<String>,
    pub amount: f64,
    pub currency_code: String,
    pub date: Option<String>,
    pub due_date: Option<String>,
    pub rate: Option<f64>,
    pub rate_type: Option<String>,
    pub fixed_annual_rate: Option<f64>,
}
