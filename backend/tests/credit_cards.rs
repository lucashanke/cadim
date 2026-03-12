mod common;

use wiremock::{Mock, ResponseTemplate, matchers::{method, path, query_param}};

fn sample_card_account(id: &str, name: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": name,
        "balance": 1500.0,
        "currencyCode": "BRL",
        "creditData": null
    })
}

fn sample_card_account_with_credit_data(id: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": "Card With Credit Data",
        "balance": 750.0,
        "currencyCode": "BRL",
        "creditData": {
            "creditLimit": 5000.0,
            "availableCreditLimit": 4250.0,
            "billDueDate": "2024-02-10",
            "minimumPayment": 75.0
        }
    })
}

fn sample_transaction(id: &str, amount: f64, txn_type: &str) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "description": format!("Transaction {}", id),
        "amount": amount,
        "currencyCode": "BRL",
        "date": "2024-01-15",
        "category": "Food",
        "type": txn_type
    })
}

fn pluggy_accounts_response(items: Vec<serde_json::Value>) -> serde_json::Value {
    serde_json::json!({ "results": items })
}

fn pluggy_transactions_response(items: Vec<serde_json::Value>, total: usize, total_pages: usize, page: usize) -> serde_json::Value {
    serde_json::json!({
        "results": items,
        "total": total,
        "totalPages": total_pages,
        "page": page
    })
}

#[tokio::test]
async fn credit_cards_list_returns_accounts() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .and(query_param("itemId", "item-1"))
        .and(query_param("type", "CREDIT"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_accounts_response(vec![
                sample_card_account("card-1", "Nubank"),
                sample_card_account("card-2", "Itaú"),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/credit-cards/item-1/list").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    let cards = body.as_array().unwrap();
    assert_eq!(cards.len(), 2);
    assert_eq!(cards[0]["id"], "card-1");
    assert_eq!(cards[0]["name"], "Nubank");
    assert_eq!(cards[0]["balance"], 1500.0);
    assert_eq!(cards[1]["id"], "card-2");
}

#[tokio::test]
async fn credit_cards_list_with_credit_data() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .and(query_param("type", "CREDIT"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_accounts_response(vec![
                sample_card_account_with_credit_data("card-1"),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/credit-cards/item-1/list").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    let cards = body.as_array().unwrap();
    assert_eq!(cards.len(), 1);
    assert_eq!(cards[0]["credit_limit"], 5000.0);
    assert_eq!(cards[0]["available_credit_limit"], 4250.0);
    assert_eq!(cards[0]["bill_due_date"], "2024-02-10");
    assert_eq!(cards[0]["minimum_payment"], 75.0);
}

#[tokio::test]
async fn credit_cards_list_returns_502_on_pluggy_error() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/accounts"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/credit-cards/item-1/list").await;

    response.assert_status(axum::http::StatusCode::BAD_GATEWAY);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().is_some());
}

#[tokio::test]
async fn transactions_list_returns_paginated_results() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/transactions"))
        .and(query_param("accountId", "acc-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_transactions_response(
                vec![
                    sample_transaction("txn-1", 100.0, "DEBIT"),
                    sample_transaction("txn-2", 50.0, "CREDIT"),
                ],
                2, 1, 1,
            )),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/transactions/acc-1").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["total"], 2);
    assert_eq!(body["total_pages"], 1);
    assert_eq!(body["page"], 1);
    let results = body["results"].as_array().unwrap();
    assert_eq!(results.len(), 2);
    assert_eq!(results[0]["id"], "txn-1");
    assert_eq!(results[0]["amount"], 100.0);
    assert_eq!(results[0]["transaction_type"], "DEBIT");
    assert_eq!(results[1]["id"], "txn-2");
}

#[tokio::test]
async fn transactions_list_uses_default_pagination() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/transactions"))
        .and(query_param("page", "1"))
        .and(query_param("pageSize", "20"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_transactions_response(vec![], 0, 0, 1)),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/transactions/acc-1").await;

    response.assert_status_ok();
}

#[tokio::test]
async fn transactions_list_returns_502_on_pluggy_error() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/transactions"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/transactions/acc-1").await;

    response.assert_status(axum::http::StatusCode::BAD_GATEWAY);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().is_some());
}
