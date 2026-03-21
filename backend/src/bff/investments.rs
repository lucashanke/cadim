use std::sync::Arc;
use axum::{extract::State, Json};
use serde::Serialize;
use tokio::task::JoinSet;

use crate::{
    auth::middleware::AuthUser,
    db::{pluggy_items, positions},
    domain::{
        investments::{format_rate, investment_type_color, investment_type_label, subtype_label},
        portfolio::{
            investment_kpis, maturity_groups, portfolio_allocation, AllocationEntry,
            InvestmentKpis, MaturityGroup, PortfolioPosition,
        },
    },
    error::AppError,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct BffPosition {
    pub id: String,
    pub name: String,
    pub investment_type: String,
    pub type_label: String,
    pub type_color: String,
    pub subtype: Option<String>,
    pub subtype_label: Option<String>,
    pub amount: f64,
    pub currency_code: String,
    pub date: Option<String>,
    pub due_date: Option<String>,
    pub rate: Option<f64>,
    pub rate_type: Option<String>,
    pub fixed_annual_rate: Option<f64>,
    pub rate_display: String,
    pub is_manual: bool,
}

#[derive(Debug, Serialize)]
pub struct BffInvestmentsErrors {
    pub positions: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BffInvestmentsResponse {
    pub positions: Vec<BffPosition>,
    pub kpis: InvestmentKpis,
    pub allocation: Vec<AllocationEntry>,
    pub maturity_groups: Vec<MaturityGroup>,
    pub errors: BffInvestmentsErrors,
}

pub async fn investments(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<BffInvestmentsResponse>, AppError> {
    // Fetch pluggy items and manual positions in parallel
    let (items_result, manual_result) = tokio::join!(
        pluggy_items::list_items(&state.db, &auth.id),
        positions::list_positions(&state.db, &auth.id, &auth.encryption_key),
    );

    let items = items_result?;
    let manual_positions = manual_result?;

    // Fetch investment positions from all Pluggy items in parallel
    let mut positions_error: Option<String> = None;
    let mut pluggy_positions = Vec::new();

    if !items.is_empty() {
        let mut handles = JoinSet::new();
        for item in &items {
            let st = state.clone();
            let item_id = item.pluggy_item_id.clone();
            handles.spawn(async move { st.pluggy_client.get_investments(&item_id).await });
        }

        while let Some(result) = handles.join_next().await {
            match result {
                Ok(Ok(investments)) => {
                    pluggy_positions.extend(investments);
                }
                Ok(Err(e)) => {
                    positions_error = Some(e.to_string());
                }
                Err(e) => {
                    positions_error = Some(e.to_string());
                }
            }
        }
    }

    // Convert Pluggy positions to BFF positions (filter zero amounts)
    let mut bff_positions: Vec<BffPosition> = pluggy_positions
        .into_iter()
        .filter(|i| i.amount != 0.0)
        .map(|i| {
            let inv_type = i.investment_type.clone().unwrap_or_default();
            let sub = i.subtype.clone();
            BffPosition {
                id: i.id,
                name: i.name.unwrap_or_default(),
                type_label: investment_type_label(&inv_type).to_string(),
                type_color: investment_type_color(&inv_type).to_string(),
                subtype_label: sub.as_deref().map(subtype_label),
                rate_display: format_rate(
                    i.rate,
                    i.rate_type.as_deref(),
                    i.fixed_annual_rate,
                ),
                investment_type: inv_type,
                subtype: sub,
                amount: i.amount,
                currency_code: i.currency_code.unwrap_or_else(|| "BRL".to_string()),
                date: i.date,
                due_date: i.due_date,
                rate: i.rate,
                rate_type: i.rate_type,
                fixed_annual_rate: i.fixed_annual_rate,
                is_manual: false,
            }
        })
        .collect();

    // Convert manual positions to BFF positions
    for p in &manual_positions {
        let name = p
            .subtype
            .as_deref()
            .map(subtype_label)
            .unwrap_or_else(|| investment_type_label(&p.investment_type).to_string());

        bff_positions.push(BffPosition {
            id: p.id.clone(),
            name,
            type_label: investment_type_label(&p.investment_type).to_string(),
            type_color: investment_type_color(&p.investment_type).to_string(),
            subtype_label: p.subtype.as_deref().map(subtype_label),
            rate_display: "—".to_string(),
            investment_type: p.investment_type.clone(),
            subtype: p.subtype.clone(),
            amount: p.amount,
            currency_code: "BRL".to_string(),
            date: None,
            due_date: p.due_date.clone(),
            rate: None,
            rate_type: None,
            fixed_annual_rate: None,
            is_manual: true,
        });
    }

    // Build PortfolioPosition list for domain computations
    let portfolio_positions: Vec<PortfolioPosition> = bff_positions
        .iter()
        .map(|p| {
            let due_date = p
                .due_date
                .as_deref()
                .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
            PortfolioPosition {
                id: p.id.clone(),
                name: p.name.clone(),
                investment_type: p.investment_type.clone(),
                subtype: p.subtype.clone(),
                amount: p.amount,
                due_date,
                is_manual: p.is_manual,
            }
        })
        .collect();

    let today = chrono::Utc::now().date_naive();
    let kpis = investment_kpis(&portfolio_positions);
    let allocation = portfolio_allocation(&portfolio_positions);
    let maturity = maturity_groups(&portfolio_positions, today);

    Ok(Json(BffInvestmentsResponse {
        positions: bff_positions,
        kpis,
        allocation,
        maturity_groups: maturity,
        errors: BffInvestmentsErrors {
            positions: positions_error,
        },
    }))
}
