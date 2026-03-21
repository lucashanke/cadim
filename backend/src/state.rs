use crate::pluggy::client::PluggyClient;
use sqlx::SqlitePool;

pub struct AppState {
    pub pluggy_client: PluggyClient,
    pub db: SqlitePool,
    pub jwt_secret: String,
    pub encryption_master_key: [u8; 32],
}
