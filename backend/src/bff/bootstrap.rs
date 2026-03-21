use axum::{extract::State, Json};
use std::sync::Arc;

use crate::auth::middleware::AuthUser;
use crate::db::{compensation, pluggy_items, positions};
use crate::error::AppError;
use crate::state::AppState;

use super::types::{
    BootstrapItem, BootstrapManualPosition, BootstrapResponse, BootstrapUser,
};

pub async fn bootstrap(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<BootstrapResponse>, AppError> {
    // All from local DB — no Pluggy API calls. Fast.
    let (items_result, positions_result, config_result) = tokio::join!(
        pluggy_items::list_items(&state.db, &auth.id),
        positions::list_positions(&state.db, &auth.id, &auth.encryption_key),
        compensation::get_config(&state.db, &auth.id, &auth.encryption_key),
    );

    let items = items_result?;
    let manual_positions = positions_result?;
    let config = config_result?;

    Ok(Json(BootstrapResponse {
        user: BootstrapUser {
            id: auth.id,
            email: String::new(), // Not stored in JWT
        },
        items: items
            .into_iter()
            .map(|i| BootstrapItem {
                id: i.pluggy_item_id,
                name: i.connector_name,
            })
            .collect(),
        manual_positions: manual_positions
            .into_iter()
            .map(|p| BootstrapManualPosition {
                id: p.id,
                investment_type: p.investment_type,
                subtype: p.subtype,
                amount: p.amount,
                due_date: p.due_date,
            })
            .collect(),
        has_compensation_config: config.is_some(),
    }))
}
