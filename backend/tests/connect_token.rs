mod common;

use wiremock::{Mock, ResponseTemplate, matchers::{method, path}};

#[tokio::test]
async fn connect_token_returns_access_token() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("POST"))
        .and(path("/connect_token"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(serde_json::json!({"accessToken": "widget-token-abc"})),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.post("/api/connect-token").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["access_token"], "widget-token-abc");
}

#[tokio::test]
async fn connect_token_returns_502_when_pluggy_auth_fails() {
    let mock_server = common::start_mock_server().await;

    // Auth endpoint returns 401 — no valid API key
    Mock::given(method("POST"))
        .and(path("/auth"))
        .respond_with(ResponseTemplate::new(401).set_body_string("Unauthorized"))
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.post("/api/connect-token").await;

    response.assert_status(axum::http::StatusCode::BAD_GATEWAY);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().is_some());
}
