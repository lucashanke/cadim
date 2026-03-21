use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::crypto;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Position {
    pub id: String,
    pub user_id: String,
    pub investment_type: String,
    pub subtype: Option<String>,
    pub amount: f64,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePosition {
    pub investment_type: String,
    pub subtype: Option<String>,
    pub amount: f64,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePosition {
    pub investment_type: Option<String>,
    pub subtype: Option<String>,
    pub amount: Option<f64>,
    pub due_date: Option<String>,
}

pub async fn list_positions(
    pool: &SqlitePool,
    user_id: &str,
    encryption_key: &[u8; 32],
) -> Result<Vec<Position>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, Vec<u8>, Vec<u8>, Option<String>)>(
        "SELECT id, user_id, investment_type, subtype, amount_encrypted, amount_nonce, due_date FROM manual_positions WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to list positions: {}", e)))?;

    rows.into_iter()
        .map(|(id, user_id, investment_type, subtype, encrypted, nonce, due_date)| {
            let amount_bytes = crypto::decrypt(encryption_key, &encrypted, &nonce)?;
            let amount_str = String::from_utf8(amount_bytes)
                .map_err(|e| AppError::Internal(format!("Invalid amount data: {}", e)))?;
            let amount: f64 = amount_str
                .parse()
                .map_err(|e| AppError::Internal(format!("Invalid amount number: {}", e)))?;
            Ok(Position {
                id,
                user_id,
                investment_type,
                subtype,
                amount,
                due_date,
            })
        })
        .collect()
}

pub async fn create_position(
    pool: &SqlitePool,
    user_id: &str,
    data: &CreatePosition,
    encryption_key: &[u8; 32],
) -> Result<Position, AppError> {
    let id = Uuid::new_v4().to_string();
    let amount_str = data.amount.to_string();
    let (encrypted, nonce) = crypto::encrypt(encryption_key, amount_str.as_bytes())?;

    sqlx::query(
        "INSERT INTO manual_positions (id, user_id, investment_type, subtype, amount_encrypted, amount_nonce, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(&data.investment_type)
    .bind(&data.subtype)
    .bind(&encrypted)
    .bind(&nonce)
    .bind(&data.due_date)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to create position: {}", e)))?;

    Ok(Position {
        id,
        user_id: user_id.to_string(),
        investment_type: data.investment_type.clone(),
        subtype: data.subtype.clone(),
        amount: data.amount,
        due_date: data.due_date.clone(),
    })
}

pub async fn update_position(
    pool: &SqlitePool,
    position_id: &str,
    user_id: &str,
    data: &UpdatePosition,
    encryption_key: &[u8; 32],
) -> Result<Position, AppError> {
    // Fetch current position and verify ownership
    let row = sqlx::query_as::<_, (String, String, String, Option<String>, Vec<u8>, Vec<u8>, Option<String>)>(
        "SELECT id, user_id, investment_type, subtype, amount_encrypted, amount_nonce, due_date FROM manual_positions WHERE id = ? AND user_id = ?",
    )
    .bind(position_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to fetch position: {}", e)))?
    .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let current_amount_bytes = crypto::decrypt(encryption_key, &row.4, &row.5)?;
    let current_amount: f64 = String::from_utf8(current_amount_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid amount data: {}", e)))?
        .parse()
        .map_err(|e| AppError::Internal(format!("Invalid amount number: {}", e)))?;

    let new_investment_type = data.investment_type.as_deref().unwrap_or(&row.2);
    let new_subtype = data.subtype.as_ref().or(row.3.as_ref());
    let new_amount = data.amount.unwrap_or(current_amount);
    let new_due_date = data.due_date.as_ref().or(row.6.as_ref());

    let amount_str = new_amount.to_string();
    let (encrypted, nonce) = crypto::encrypt(encryption_key, amount_str.as_bytes())?;

    sqlx::query(
        "UPDATE manual_positions SET investment_type = ?, subtype = ?, amount_encrypted = ?, amount_nonce = ?, due_date = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
    )
    .bind(new_investment_type)
    .bind(new_subtype)
    .bind(&encrypted)
    .bind(&nonce)
    .bind(new_due_date)
    .bind(position_id)
    .bind(user_id)
    .execute(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to update position: {}", e)))?;

    Ok(Position {
        id: position_id.to_string(),
        user_id: user_id.to_string(),
        investment_type: new_investment_type.to_string(),
        subtype: new_subtype.cloned(),
        amount: new_amount,
        due_date: new_due_date.cloned(),
    })
}

pub async fn delete_position(
    pool: &SqlitePool,
    position_id: &str,
    user_id: &str,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM manual_positions WHERE id = ? AND user_id = ?")
        .bind(position_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete position: {}", e)))?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Position not found".into()));
    }
    Ok(())
}
