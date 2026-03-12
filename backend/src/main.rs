use cadim_backend::pluggy::client::PluggyClient;
use tracing_subscriber;
use cadim_backend::routes::build_router;
use cadim_backend::state::AppState;
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

    let state = Arc::new(AppState {
        pluggy_client: PluggyClient::new(pluggy_client_id, pluggy_client_secret),
    });

    let app = build_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    println!("🚀 cadim backend listening on http://localhost:3001");
    axum::serve(listener, app).await.unwrap();
}
