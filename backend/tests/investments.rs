mod common;

use wiremock::{Mock, ResponseTemplate, matchers::{method, path, query_param}};

fn sample_investment(id: &str, amount: f64, subtype: Option<&str>) -> serde_json::Value {
    serde_json::json!({
        "id": id,
        "name": format!("Investment {}", id),
        "type": "FIXED_INCOME",
        "subtype": subtype,
        "amount": amount,
        "currencyCode": "BRL",
        "date": "2024-01-01",
        "dueDate": "2025-01-01",
        "rate": 100.0,
        "rateType": "CDI",
        "fixedAnnualRate": null
    })
}

fn pluggy_investments_response(items: Vec<serde_json::Value>) -> serde_json::Value {
    serde_json::json!({ "results": items })
}

#[tokio::test]
async fn investments_list_returns_positions() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/investments"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_investments_response(vec![
                sample_investment("inv-1", 1000.0, Some("CDB")),
                sample_investment("inv-2", 500.0, Some("LCI")),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/investments/item-1/list").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    let positions = body.as_array().unwrap();
    assert_eq!(positions.len(), 2);
    assert_eq!(positions[0]["id"], "inv-1");
    assert_eq!(positions[0]["investment_type"], "FIXED_INCOME");
    assert_eq!(positions[0]["subtype"], "CDB");
    assert_eq!(positions[0]["amount"], 1000.0);
    assert_eq!(positions[1]["id"], "inv-2");
}

#[tokio::test]
async fn investments_list_excludes_zero_amount_positions() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/investments"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_investments_response(vec![
                sample_investment("inv-1", 1000.0, Some("CDB")),
                sample_investment("inv-zero", 0.0, Some("LCI")),
                sample_investment("inv-2", 250.0, None),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/investments/item-1/list").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    let positions = body.as_array().unwrap();
    assert_eq!(positions.len(), 2);
    assert!(positions.iter().all(|p| p["id"] != "inv-zero"));
}

#[tokio::test]
async fn investments_list_passes_through_null_subtype() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/investments"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_investments_response(vec![
                sample_investment("inv-1", 500.0, None),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/investments/item-1/list").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    let positions = body.as_array().unwrap();
    assert_eq!(positions.len(), 1);
    assert!(positions[0]["subtype"].is_null());
}

#[tokio::test]
async fn investments_list_returns_502_when_pluggy_errors() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/investments"))
        .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/investments/item-1/list").await;

    response.assert_status(axum::http::StatusCode::BAD_GATEWAY);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().is_some());
}

#[tokio::test]
async fn investments_summary_returns_aggregated_totals() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/investments"))
        .and(query_param("itemId", "item-1"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(pluggy_investments_response(vec![
                sample_investment("inv-1", 1000.0, Some("CDB")),
                sample_investment("inv-2", 500.0, Some("LCI")),
                sample_investment("inv-3", 250.0, Some("CDB")),
            ])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/investments/item-1/summary").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["total_gross_amount"], 1750.0);
    assert_eq!(body["investment_count"], 3);
    assert_eq!(body["currency_code"], "BRL");
}

#[tokio::test]
async fn investments_summary_returns_zeros_when_no_results() {
    let mock_server = common::start_mock_server().await;
    common::mount_auth_mock(&mock_server).await;

    Mock::given(method("GET"))
        .and(path("/investments"))
        .and(query_param("itemId", "item-empty"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(pluggy_investments_response(vec![])),
        )
        .mount(&mock_server)
        .await;

    let server = common::build_test_server(&mock_server).await;
    let response = server.get("/api/investments/item-empty/summary").await;

    response.assert_status_ok();
    let body: serde_json::Value = response.json();
    assert_eq!(body["total_gross_amount"], 0.0);
    assert_eq!(body["investment_count"], 0);
    assert_eq!(body["currency_code"], "BRL");
}
