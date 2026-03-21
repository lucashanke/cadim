use cadim_backend::pluggy::client::PluggyClient;
use cadim_backend::routes::build_router;
use cadim_backend::state::AppState;
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let env_filter = tracing_subscriber::EnvFilter::from_default_env();
    if std::env::var("APP_ENV").as_deref() == Ok("production") {
        tracing_subscriber::fmt().json().with_env_filter(env_filter).init();
    } else {
        tracing_subscriber::fmt().pretty().with_env_filter(env_filter).init();
    }

    let pluggy_client_id = std::env::var("PLUGGY_CLIENT_ID")
        .expect("PLUGGY_CLIENT_ID must be set in .env");
    let pluggy_client_secret = std::env::var("PLUGGY_CLIENT_SECRET")
        .expect("PLUGGY_CLIENT_SECRET must be set in .env");

    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:cadim.db?mode=rwc".into());
    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("Failed to run migrations");

    let jwt_secret =
        std::env::var("JWT_SECRET").expect("JWT_SECRET must be set in .env");

    let master_key_hex =
        std::env::var("ENCRYPTION_MASTER_KEY").expect("ENCRYPTION_MASTER_KEY must be set in .env");
    let master_key_bytes = hex::decode(&master_key_hex).expect("ENCRYPTION_MASTER_KEY must be valid hex");
    let encryption_master_key: [u8; 32] = master_key_bytes
        .try_into()
        .expect("ENCRYPTION_MASTER_KEY must be exactly 32 bytes (64 hex chars)");

    let state = Arc::new(AppState {
        pluggy_client: PluggyClient::new(pluggy_client_id, pluggy_client_secret),
        db,
        jwt_secret,
        encryption_master_key,
    });

    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    println!("🚀 cadim backend listening on http://localhost:3001");
    axum::serve(listener, app).await.unwrap();
}
