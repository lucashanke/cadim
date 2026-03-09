use cadim_backend::pluggy::client::PluggyClient;
use cadim_backend::routes::build_router;
use cadim_backend::state::AppState;
use std::sync::Arc;
use wiremock::{Mock, MockServer, ResponseTemplate, matchers::{method, path}};
use axum_test::TestServer;

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
    let state = Arc::new(AppState {
        pluggy_client: PluggyClient::new_with_base_url(
            "test-id".to_string(),
            "test-secret".to_string(),
            mock_server.uri(),
        ),
    });
    let router = build_router(state);
    TestServer::new(router)
}
