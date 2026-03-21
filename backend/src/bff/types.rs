use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct BootstrapUser {
    pub id: String,
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct BootstrapItem {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct BootstrapManualPosition {
    pub id: String,
    pub investment_type: String,
    pub subtype: Option<String>,
    pub amount: f64,
    pub due_date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BootstrapResponse {
    pub user: BootstrapUser,
    pub items: Vec<BootstrapItem>,
    pub manual_positions: Vec<BootstrapManualPosition>,
    pub has_compensation_config: bool,
}
