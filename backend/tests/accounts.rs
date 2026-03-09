mod common;

use wiremock::{Mock, ResponseTemplate, matchers::{method, path, query_param}};

fn pluggy_accounts_response(items: Vec<serde_json::Value>) -> serde_json::Value {
    serde_json::json!({ "results": items })
}

fn checking_account(balance: f64) -> serde_json::Value {
    serde_json::json!({
        "balance": balance,
        "subtype": "CHECKING_ACCOUNT",
        "currencyCode": "BRL"
    })
}

fn savings_account(balance: f64) -> serde_json::Value {
    serde_json::json!({
        "balance": balance,
        "subtype": "SAVINGS_ACCOUNT",
        "currencyCode": "BRL"
    })
}

#[tokio::test]
async fn accounts_summary_returns_correct_total_and_count() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_accounts_response(vec![
                checking_account(1500.0),
                checking_account(800.0),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/accounts/item-1/summary").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["total_balance"], 2300.0);
    assert_eq!(body["account_count"], 2);
    assert_eq!(body["currency_code"], "BRL");
}

#[tokio::test]
async fn accounts_summary_only_includes_checking_accounts() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_accounts_response(vec![
                checking_account(1000.0),
                savings_account(5000.0),
                checking_account(200.0),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/accounts/item-1/summary").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["total_balance"], 1200.0);
    assert_eq!(body["account_count"], 2);
}

#[tokio::test]
async fn accounts_summary_returns_502_when_pluggy_errors() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/accounts/item-1/summary").await;

    response.assert_status(axum::http::StatusCode::BAD_GATEWAY);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().is_some());
}
