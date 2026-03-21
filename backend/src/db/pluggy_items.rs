use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluggyItem {
    pub id: String,
    pub user_id: String,
    pub pluggy_item_id: String,
    pub connector_name: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePluggyItem {
    pub pluggy_item_id: String,
    pub connector_name: String,
}

pub async fn list_items(pool: &SqlitePool, user_id: &str) -> Result<Vec<PluggyItem>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, user_id, pluggy_item_id, connector_name FROM pluggy_items WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to list pluggy items: {}", e)))?;

    Ok(rows
        .into_iter()
        .map(|(id, user_id, pluggy_item_id, connector_name)| PluggyItem {
            id,
            user_id,
            pluggy_item_id,
            connector_name,
        })
        .collect())
}

pub async fn create_item(
    pool: &SqlitePool,
    user_id: &str,
    data: &CreatePluggyItem,
) -> Result<PluggyItem, AppError> {
    // Check if already exists (idempotent)
    let existing = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, user_id, pluggy_item_id, connector_name FROM pluggy_items WHERE user_id = ? AND pluggy_item_id = ?",
    )
    .bind(user_id)
    .bind(&data.pluggy_item_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to check pluggy item: {}", e)))?;

    if let Some((id, user_id, pluggy_item_id, connector_name)) = existing {
        return Ok(PluggyItem {
            id,
            user_id,
            pluggy_item_id,
            connector_name,
        });
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO pluggy_items (id, user_id, pluggy_item_id, connector_name) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&data.pluggy_item_id)
    .bind(&data.connector_name)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to create pluggy item: {}", e)))?;

    Ok(PluggyItem {
        id,
        user_id: user_id.to_string(),
        pluggy_item_id: data.pluggy_item_id.clone(),
        connector_name: data.connector_name.clone(),
    })
}

pub async fn delete_item(
    pool: &SqlitePool,
    pluggy_item_id: &str,
    user_id: &str,
) -> Result<(), AppError> {
    let result =
        sqlx::query("DELETE FROM pluggy_items WHERE pluggy_item_id = ? AND user_id = ?")
            .bind(pluggy_item_id)
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to delete pluggy item: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Pluggy item not found".into()));
    }
    Ok(())
}
