mod error;
mod pluggy;
mod routes;
mod state;

use std::sync::Arc;
use state::AppState;
use pluggy::client::PluggyClient;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let pluggy_client_id = std::env::var("PLUGGY_CLIENT_ID")
        .expect("PLUGGY_CLIENT_ID must be set in .env");
    let pluggy_client_secret = std::env::var("PLUGGY_CLIENT_SECRET")
        .expect("PLUGGY_CLIENT_SECRET must be set in .env");

    let state = Arc::new(AppState {
        pluggy_client: PluggyClient::new(pluggy_client_id, pluggy_client_secret),
    });

    let app = routes::build_router(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    println!("🚀 cadim backend listening on http://localhost:3001");
    axum::serve(listener, app).await.unwrap();
}
