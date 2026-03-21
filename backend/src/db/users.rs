use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;

pub struct User {
    pub id: String,
    pub email: String,
    pub password_hash: String,
    pub encryption_salt: Vec<u8>,
}

pub async fn create_user(
    pool: &SqlitePool,
    email: &str,
    password: &str,
) -> Result<User, AppError> {
    let id = Uuid::new_v4().to_string();
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?
        .to_string();

    let encryption_salt: [u8; 16] = rand::random();

    sqlx::query(
        "INSERT INTO users (id, email, password_hash, encryption_salt) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(email)
    .bind(&password_hash)
    .bind(&encryption_salt[..])
    .execute(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.message().contains("UNIQUE constraint failed") {
                return AppError::Conflict("Email already registered".into());
            }
        }
        AppError::Internal(format!("Failed to create user: {}", e))
    })?;

    Ok(User {
        id,
        email: email.to_string(),
        password_hash,
        encryption_salt: encryption_salt.to_vec(),
    })
}

pub async fn find_by_email(pool: &SqlitePool, email: &str) -> Result<Option<User>, AppError> {
    let row = sqlx::query_as::<_, (String, String, String, Vec<u8>)>(
        "SELECT id, email, password_hash, encryption_salt FROM users WHERE email = ?",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to find user: {}", e)))?;

    Ok(row.map(|(id, email, password_hash, encryption_salt)| User {
        id,
        email,
        password_hash,
        encryption_salt,
    }))
}

pub fn verify_password(password: &str, password_hash: &str) -> Result<bool, AppError> {
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|e| AppError::Internal(format!("Invalid password hash: {}", e)))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
