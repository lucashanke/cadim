mod common;

use wiremock::{Mock, ResponseTemplate, matchers::{method, path}};

#[tokio::test]
async fn get_item_returns_connector_name() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/items/item-abc"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "connector": { "name": "Nubank" }
            })),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/items/item-abc").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["connector_name"], "Nubank");
    assert_eq!(body["id"], "item-abc");
}

#[tokio::test]
async fn delete_item_returns_204() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("DELETE"))
        .and(path("/items/item-abc"))
        .respond_with(ResponseTemplate::new(204))
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.delete("/api/items/item-abc").await;

    response.assert_status(axum::http::StatusCode::NO_CONTENT);
}
