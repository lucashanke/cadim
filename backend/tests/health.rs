mod common;

#[tokio::test]
async fn health_returns_ok() {
    let mock_server = common::start_mock_server().await;
    let server = common::build_test_server(&mock_server).await;

    let response = server.get("/api/health").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "ok");
    assert_eq!(body["message"], "cadim backend is running");
}
