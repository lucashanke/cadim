use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use super::types::MarketRates;

#[derive(Deserialize)]
struct BcbDataPoint {
    valor: String,
}

pub async fn get_rates() -> Result<Json<MarketRates>, (StatusCode, String)> {
    let client = reqwest::Client::new();

    let (cdi_res, ipca_res) = tokio::join!(
        client
            .get("https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json")
            .send(),
        client
            .get("https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json")
            .send(),
    );

    let cdi_data: Vec<BcbDataPoint> = cdi_res
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to fetch CDI: {e}")))?
        .json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to parse CDI: {e}")))?;

    let ipca_data: Vec<BcbDataPoint> = ipca_res
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to fetch IPCA: {e}")))?
        .json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to parse IPCA: {e}")))?;

    let cdi_annual = cdi_data
        .first()
        .and_then(|d| d.valor.replace(',', ".").parse::<f64>().ok())
        .ok_or((StatusCode::BAD_GATEWAY, "No CDI data returned".to_string()))?;

    // Compound monthly IPCA variations into trailing 12-month rate
    let ipca_annual = ipca_data
        .iter()
        .try_fold(1.0_f64, |acc, d| {
            d.valor
                .replace(',', ".")
                .parse::<f64>()
                .map(|v| acc * (1.0 + v / 100.0))
                .ok()
        })
        .map(|compounded| (compounded - 1.0) * 100.0)
        .ok_or((StatusCode::BAD_GATEWAY, "Invalid IPCA data".to_string()))?;

    Ok(Json(MarketRates {
        cdi_annual,
        ipca_annual,
    }))
}
