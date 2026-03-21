use cadim_backend::pluggy::client::PluggyClient;
use cadim_backend::routes::build_router;
use cadim_backend::state::AppState;
use std::sync::Arc;
use wiremock::{Mock, MockServer, ResponseTemplate, matchers::{method, path}};
use axum_test::TestServer;
use sqlx::sqlite::SqlitePoolOptions;

pub async fn start_mock_server() -> MockServer {
    MockServer::start().await
}

pub async fn mount_auth_mock(server: &MockServer) {
    Mock::given(method("POST"))
        .and(path("/auth"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(serde_json::json!({"apiKey": "test-api-key"})),
        )
        .mount(server)
        .await;
}

pub async fn build_test_server(mock_server: &MockServer) -> TestServer {
    let db = SqlitePoolOptions::new()
        .connect("sqlite::memory:")
        .await
        .expect("Failed to connect to in-memory SQLite");

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("Failed to run migrations");

    let state = Arc::new(AppState {
        pluggy_client: PluggyClient::new_with_base_url(
            "test-id".to_string(),
            "test-secret".to_string(),
            mock_server.uri(),
        ),
        db,
        jwt_secret: "test-jwt-secret".to_string(),
        encryption_master_key: [0xAB; 32],
    });
    let router = build_router(state);
    TestServer::new(router)
}
