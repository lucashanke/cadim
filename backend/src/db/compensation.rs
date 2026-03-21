use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::crypto;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct SalaryDeduction {
    pub name: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompensationConfig {
    pub gross_salary: f64,
    #[serde(default)]
    pub deductions: Vec<SalaryDeduction>,
    #[serde(default)]
    pub thirteenth_received: f64,
    #[serde(default)]
    pub vacation_third_received: f64,
    #[serde(default)]
    pub bonus_year: Option<i32>,
    #[serde(default)]
    pub compound_savings: bool,
}

pub async fn get_config(
    pool: &SqlitePool,
    user_id: &str,
    encryption_key: &[u8; 32],
) -> Result<Option<CompensationConfig>, AppError> {
    let row = sqlx::query_as::<_, (Vec<u8>, Vec<u8>)>(
        "SELECT config_encrypted, config_nonce FROM compensation_configs WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to fetch compensation config: {}", e)))?;

    match row {
        None => Ok(None),
        Some((encrypted, nonce)) => {
            let plaintext = crypto::decrypt(encryption_key, &encrypted, &nonce)?;
            let config: CompensationConfig = serde_json::from_slice(&plaintext)
                .map_err(|e| AppError::Internal(format!("Invalid config data: {}", e)))?;
            Ok(Some(config))
        }
    }
}

pub async fn upsert_config(
    pool: &SqlitePool,
    user_id: &str,
    config: &CompensationConfig,
    encryption_key: &[u8; 32],
) -> Result<(), AppError> {
    let json = serde_json::to_vec(config)
        .map_err(|e| AppError::Internal(format!("Failed to serialize config: {}", e)))?;
    let (encrypted, nonce) = crypto::encrypt(encryption_key, &json)?;

    // Check if config exists
    let exists = sqlx::query_as::<_, (String,)>(
        "SELECT id FROM compensation_configs WHERE user_id = ?",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to check config: {}", e)))?;

    match exists {
        Some((id,)) => {
            sqlx::query(
                "UPDATE compensation_configs SET config_encrypted = ?, config_nonce = ?, updated_at = datetime('now') WHERE id = ?",
            )
            .bind(&encrypted)
            .bind(&nonce)
            .bind(&id)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to update config: {}", e)))?;
        }
        None => {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO compensation_configs (id, user_id, config_encrypted, config_nonce) VALUES (?, ?, ?, ?)",
            )
            .bind(&id)
            .bind(user_id)
            .bind(&encrypted)
            .bind(&nonce)
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to insert config: {}", e)))?;
        }
    }

    Ok(())
}
