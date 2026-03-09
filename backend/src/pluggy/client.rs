use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use reqwest::Client;
use crate::error::AppError;
use super::types::{
    PluggyAuthRequest, PluggyAuthResponse, PluggyAccountsResponse,
    PluggyAccount, PluggyConnectTokenResponse, PluggyItemResponse,
    PluggyInvestment, PluggyInvestmentsResponse,
};

const PLUGGY_BASE_URL: &str = "https://api.pluggy.ai";

struct CachedApiKey {
    key: String,
    expires_at: Instant,
}

pub struct PluggyClient {
    http_client: Client,
    client_id: String,
    client_secret: String,
    base_url: String,
    cached_key: RwLock<Option<CachedApiKey>>,
}

impl PluggyClient {
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self::new_with_base_url(client_id, client_secret, PLUGGY_BASE_URL.to_string())
    }

    pub fn new_with_base_url(client_id: String, client_secret: String, base_url: String) -> Self {
        Self {
            http_client: Client::new(),
            client_id,
            client_secret,
            base_url,
            cached_key: RwLock::new(None),
        }
    }

    async fn execute_request(&self, req: reqwest::RequestBuilder, err_ctx: &str) -> Result<reqwest::Response, AppError> {
        let resp = req
            .send()
            .await
            .map_err(|e| AppError::PluggyClient(format!("{}: {}", err_ctx, e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::PluggyServer { status, msg: text });
        }

        Ok(resp)
    }

    async fn execute_json_request<T: serde::de::DeserializeOwned>(
        &self,
        req: reqwest::RequestBuilder,
        err_ctx: &str,
    ) -> Result<T, AppError> {
        let resp = self.execute_request(req, err_ctx).await?;

        resp.json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse response for {}: {}", err_ctx, e)))
    }

    async fn get_api_key(&self) -> Result<String, AppError> {
        // Fast path: try to get the cached key with a read lock
        {
            let cache_lk = self.cached_key.read().await;
            if let Some(cache) = &*cache_lk {
                if Instant::now() < cache.expires_at {
                    return Ok(cache.key.clone());
                }
            }
        } // Drop read lock before acquiring write lock

        // Slow path: acquire write lock and fetch new key
        let mut cache_lk = self.cached_key.write().await;

        // Double-check in case another thread already updated the cache while we waited
        if let Some(cache) = &*cache_lk {
            if Instant::now() < cache.expires_at {
                return Ok(cache.key.clone());
            }
        }

        let body = PluggyAuthRequest {
            client_id: self.client_id.clone(),
            client_secret: self.client_secret.clone(),
        };

        let req = self
            .http_client
            .post(format!("{}/auth", self.base_url))
            .json(&body);

        let auth: PluggyAuthResponse = self.execute_json_request(req, "Failed to call auth").await?;

        // Cache the new token. Set expiration to 100 mins (Pluggy tokens are valid for 2 hours)
        *cache_lk = Some(CachedApiKey {
            key: auth.api_key.clone(),
            expires_at: Instant::now() + Duration::from_secs(6000),
        });

        Ok(auth.api_key)
    }

    pub async fn create_connect_token(&self) -> Result<String, AppError> {
        let api_key = self.get_api_key().await?;

        let req = self
            .http_client
            .post(format!("{}/connect_token", self.base_url))
            .header("X-API-KEY", &api_key)
            .json(&serde_json::json!({}));

        let token: PluggyConnectTokenResponse = self.execute_json_request(req, "Failed to create connect token").await?;
        Ok(token.access_token)
    }

    pub async fn get_checking_accounts(&self, item_id: &str) -> Result<Vec<PluggyAccount>, AppError> {
        let api_key = self.get_api_key().await?;

        let req = self
            .http_client
            .get(format!("{}/accounts", self.base_url))
            .query(&[("itemId", item_id), ("type", &"BANK")])
            .header("X-API-KEY", &api_key);

        let accounts: PluggyAccountsResponse = self.execute_json_request(req, "Failed to fetch accounts").await?;

        let checking_accounts = accounts
            .results
            .into_iter()
            .filter(|a| {
                a.subtype
                    .as_deref()
                    .map(|s| s == "CHECKING_ACCOUNT")
                    .unwrap_or(false)
            })
            .collect();

        Ok(checking_accounts)
    }

    pub async fn get_investments(&self, item_id: &str) -> Result<Vec<PluggyInvestment>, AppError> {
        let api_key = self.get_api_key().await?;
        let req = self.http_client
            .get(format!("{}/investments", self.base_url))
            .query(&[("itemId", item_id)])
            .header("X-API-KEY", &api_key);
        let investments: PluggyInvestmentsResponse =
            self.execute_json_request(req, "Failed to fetch investments").await?;
        Ok(investments.results)
    }

    pub async fn get_item_info(&self, item_id: &str) -> Result<PluggyItemResponse, AppError> {
        let api_key = self.get_api_key().await?;

        let url = format!("{}/items/{}", self.base_url, item_id);
        let req = self
            .http_client
            .get(&url)
            .header("X-API-KEY", &api_key);

        self.execute_json_request(req, "Failed to fetch item").await
    }

    pub async fn delete_item(&self, item_id: &str) -> Result<(), AppError> {
        let api_key = self.get_api_key().await?;

        let url = format!("{}/items/{}", self.base_url, item_id);
        let req = self
            .http_client
            .delete(&url)
            .header("X-API-KEY", &api_key);

        self.execute_request(req, "Failed to delete item").await?;
        Ok(())
    }
}
