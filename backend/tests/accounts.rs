mod common;

use wiremock::{Mock, ResponseTemplate, matchers::{method, path, query_param, any}};

fn pluggy_accounts_response(items: Vec<serde_json::Value>) -> serde_json::Value {
    serde_json::json!({ "results": items })
}

fn checking_account(balance: f64) -> serde_json::Value {
    checking_account_with_id(balance, "acc-1")
}

fn checking_account_with_id(balance: f64, id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "balance": balance,
        "subtype": "CHECKING_ACCOUNT",
        "currencyCode": "BRL"
    })
}

fn savings_account(balance: f64) -> serde_json::Value {
    serde_json::json!({
        "id": "sav-1",
        "balance": balance,
        "subtype": "SAVINGS_ACCOUNT",
        "currencyCode": "BRL"
    })
}

fn transaction(amount: f64, date: &str, category: Option<&str>) -> serde_json::Value {
    serde_json::json!({
        "id": format!("tx-{}", date),
        "description": "Test transaction",
        "amount": amount,
        "currencyCode": "BRL",
        "date": date,
        "category": category,
        "type": "DEBIT"
    })
}

fn transactions_response(txs: Vec<serde_json::Value>) -> serde_json::Value {
    let total = txs.len();
    serde_json::json!({
        "results": txs,
        "total": total,
        "totalPages": 1,
        "page": 1
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

#[tokio::test]
async fn average_expenses_returns_correct_average_across_months() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    // Mock accounts endpoint — return one checking account
    Mock::given(method("GET"))
        .and(path("/accounts"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_accounts_response(vec![
                checking_account_with_id(1000.0, "acc-100"),
            ])),
        )
        .mount(&mock_server)
        .await;

    // Mock transactions for that account
    Mock::given(method("GET"))
        .and(path("/transactions"))
        .and(query_param("accountId", "acc-100"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(transactions_response(vec![
                transaction(-500.0, "2025-10-05", Some("Food")),
                transaction(-300.0, "2025-10-15", Some("Transport")),
                transaction(-600.0, "2025-11-10", Some("Food")),
                transaction(-400.0, "2025-12-01", Some("Shopping")),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server
        .get("/api/accounts/expenses")
        .add_query_param("item_ids", "item-1")
        .await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    // 3 months: Oct=800, Nov=600, Dec=400 → average = 600
    assert_eq!(body["average_monthly_expenses"], 600.0);
    assert_eq!(body["months_analyzed"], 3);
    assert_eq!(body["currency_code"], "BRL");
    // Verify breakdown is present with transactions
    let breakdown = body["monthly_breakdown"].as_array().unwrap();
    assert_eq!(breakdown.len(), 3);
    // Sorted descending by month
    assert_eq!(breakdown[0]["month"], "2025-12");
    assert_eq!(breakdown[0]["total"], 400.0);
    assert_eq!(breakdown[0]["transactions"].as_array().unwrap().len(), 1);
    assert_eq!(breakdown[1]["month"], "2025-11");
    assert_eq!(breakdown[2]["month"], "2025-10");
    assert_eq!(breakdown[2]["transactions"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn average_expenses_excludes_positive_transactions() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_accounts_response(vec![
                checking_account_with_id(1000.0, "acc-200"),
            ])),
        )
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/transactions"))
        .and(query_param("accountId", "acc-200"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(transactions_response(vec![
                transaction(5000.0, "2025-10-01", Some("Salary")),  // income — excluded
                transaction(-200.0, "2025-10-05", Some("Food")),
                transaction(-100.0, "2025-10-15", Some("Transport")),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server
        .get("/api/accounts/expenses")
        .add_query_param("item_ids", "item-1")
        .await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["average_monthly_expenses"], 300.0);
    assert_eq!(body["months_analyzed"], 1);
}

#[tokio::test]
async fn average_expenses_returns_zero_when_no_transactions() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_accounts_response(vec![
                checking_account_with_id(1000.0, "acc-300"),
            ])),
        )
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/transactions"))
        .and(query_param("accountId", "acc-300"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(transactions_response(vec![])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server
        .get("/api/accounts/expenses")
        .add_query_param("item_ids", "item-1")
        .await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["average_monthly_expenses"], 0.0);
    assert_eq!(body["months_analyzed"], 0);
}
