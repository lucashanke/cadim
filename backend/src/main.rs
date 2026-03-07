use axum::{routing::get, Json, Router};
use serde::Serialize;
use tower_http::cors::CorsLayer;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    message: String,
}

#[derive(Serialize)]
struct Item {
    id: u32,
    name: String,
    description: String,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        message: "cadim backend is running".to_string(),
    })
}

async fn get_items() -> Json<Vec<Item>> {
    let items = vec![
        Item {
            id: 1,
            name: "First Item".to_string(),
            description: "This is the first sample item".to_string(),
        },
        Item {
            id: 2,
            name: "Second Item".to_string(),
            description: "This is the second sample item".to_string(),
        },
        Item {
            id: 3,
            name: "Third Item".to_string(),
            description: "This is the third sample item".to_string(),
        },
    ];
    Json(items)
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/items", get(get_items))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await.unwrap();
    println!("🚀 cadim backend listening on http://localhost:3001");
    axum::serve(listener, app).await.unwrap();
}
