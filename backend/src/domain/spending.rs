use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize)]
pub struct CategoryTotal {
    pub name: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransactionItem {
    pub id: String,
    pub description: String,
    pub amount: f64,
    pub currency_code: String,
    pub date: String,
    pub category: Option<String>,
    pub amount_in_account_currency: Option<f64>,
    pub resolved_amount: f64,
    pub transaction_type: String,
    pub card_last_four: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BillingCycle {
    pub key: String,
    pub label: String,
    pub total: f64,
    pub currency_code: String,
    pub transactions: Vec<TransactionItem>,
    pub categories: Vec<CategoryTotal>,
}

/// Categories excluded from spending analytics.
const EXCLUDED_CATEGORIES: &[&str] = &["Credit card payment", "Transfers"];

/// Compute category totals from transactions, excluding payments/transfers.
pub fn compute_categories(transactions: &[TransactionItem]) -> Vec<CategoryTotal> {
    let mut by_category: HashMap<String, f64> = HashMap::new();

    for t in transactions {
        if let Some(ref cat) = t.category {
            if EXCLUDED_CATEGORIES.contains(&cat.as_str()) {
                continue;
            }
            *by_category.entry(cat.clone()).or_default() += t.resolved_amount.abs();
        } else {
            *by_category.entry("Unknown".into()).or_default() += t.resolved_amount.abs();
        }
    }

    let mut result: Vec<CategoryTotal> = by_category
        .into_iter()
        .map(|(name, amount)| CategoryTotal { name, amount })
        .collect();
    result.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap());
    result
}

/// Merge billing cycles from multiple cards by key (month).
/// Combines transactions, totals, and categories.
pub fn merge_billing_cycles(all_card_cycles: Vec<Vec<BillingCycle>>) -> Vec<BillingCycle> {
    let mut merged: HashMap<String, BillingCycle> = HashMap::new();

    for card_cycles in all_card_cycles {
        for cycle in card_cycles {
            match merged.get_mut(&cycle.key) {
                None => {
                    merged.insert(cycle.key.clone(), cycle);
                }
                Some(existing) => {
                    // Merge transactions sorted by date descending
                    existing.transactions.extend(cycle.transactions);
                    existing
                        .transactions
                        .sort_by(|a, b| b.date.cmp(&a.date));

                    // Merge totals
                    existing.total += cycle.total;

                    // Merge categories
                    let mut cat_map: HashMap<String, f64> = HashMap::new();
                    for cat in &existing.categories {
                        *cat_map.entry(cat.name.clone()).or_default() += cat.amount;
                    }
                    for cat in &cycle.categories {
                        *cat_map.entry(cat.name.clone()).or_default() += cat.amount;
                    }
                    let mut cats: Vec<CategoryTotal> = cat_map
                        .into_iter()
                        .map(|(name, amount)| CategoryTotal { name, amount })
                        .collect();
                    cats.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap());
                    existing.categories = cats;
                }
            }
        }
    }

    let mut result: Vec<BillingCycle> = merged.into_values().collect();
    // Sort by key descending (newest first)
    result.sort_by(|a, b| b.key.cmp(&a.key));
    result
}

// ── Spending Trend ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SpendingTrendPoint {
    pub label: String,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpendingTrend {
    pub data_points: Vec<SpendingTrendPoint>,
    pub current_total: f64,
    pub previous_total: f64,
    pub change_percentage: Option<f64>,
}

pub fn spending_trend(cycles: &[BillingCycle]) -> Option<SpendingTrend> {
    if cycles.len() < 2 {
        return None;
    }

    let mut sorted: Vec<&BillingCycle> = cycles.iter().collect();
    sorted.sort_by(|a, b| a.key.cmp(&b.key));

    let data_points: Vec<SpendingTrendPoint> = sorted
        .iter()
        .map(|c| SpendingTrendPoint {
            label: c.label.clone(),
            total: c.total.abs(),
        })
        .collect();

    let current = data_points.last().unwrap().total;
    let previous = data_points[data_points.len() - 2].total;
    let change = if previous > 0.0 {
        Some(((current - previous) / previous) * 100.0)
    } else {
        None
    };

    Some(SpendingTrend {
        data_points,
        current_total: current,
        previous_total: previous,
        change_percentage: change,
    })
}

// ── Spending History ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SpendingHistoryDataPoint {
    pub label: String,
    pub values: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpendingHistory {
    pub categories: Vec<String>,
    pub data_points: Vec<SpendingHistoryDataPoint>,
    pub category_totals: HashMap<String, f64>,
}

pub fn spending_history(cycles: &[BillingCycle], top_n: usize) -> Option<SpendingHistory> {
    if cycles.len() < 2 {
        return None;
    }

    // Take last 6 cycles, oldest first
    let mut sorted: Vec<&BillingCycle> = cycles.iter().collect();
    sorted.sort_by(|a, b| a.key.cmp(&b.key));
    let recent: Vec<&BillingCycle> = sorted.into_iter().rev().take(6).collect::<Vec<_>>().into_iter().rev().collect();

    // Aggregate category totals across all cycles
    let mut category_totals: HashMap<String, f64> = HashMap::new();
    for cycle in &recent {
        for cat in &cycle.categories {
            *category_totals.entry(cat.name.clone()).or_default() += cat.amount;
        }
    }

    // Top N categories by total
    let mut cat_entries: Vec<(String, f64)> = category_totals.clone().into_iter().collect();
    cat_entries.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    let top_categories: Vec<String> = cat_entries.iter().take(top_n).map(|(k, _)| k.clone()).collect();

    // Build data points
    let data_points: Vec<SpendingHistoryDataPoint> = recent
        .iter()
        .map(|cycle| {
            let mut values: HashMap<String, f64> = HashMap::new();
            for cat_name in &top_categories {
                values.insert(cat_name.clone(), 0.0);
            }
            for cat in &cycle.categories {
                if top_categories.contains(&cat.name) {
                    *values.entry(cat.name.clone()).or_default() += cat.amount;
                }
            }
            SpendingHistoryDataPoint {
                label: cycle.label.clone(),
                values,
            }
        })
        .collect();

    // Filter category_totals to top N only
    let filtered_totals: HashMap<String, f64> = category_totals
        .into_iter()
        .filter(|(k, _)| top_categories.contains(k))
        .collect();

    Some(SpendingHistory {
        categories: top_categories,
        data_points,
        category_totals: filtered_totals,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_transaction(
        id: &str,
        amount: f64,
        category: Option<&str>,
        date: &str,
    ) -> TransactionItem {
        TransactionItem {
            id: id.into(),
            description: format!("Txn {}", id),
            amount,
            currency_code: "BRL".into(),
            date: date.into(),
            category: category.map(|s| s.into()),
            amount_in_account_currency: None,
            resolved_amount: amount,
            transaction_type: "DEBIT".into(),
            card_last_four: None,
        }
    }

    fn make_cycle(key: &str, label: &str, transactions: Vec<TransactionItem>) -> BillingCycle {
        let total: f64 = transactions.iter().map(|t| t.amount).sum();
        let categories = compute_categories(&transactions);
        BillingCycle {
            key: key.into(),
            label: label.into(),
            total,
            currency_code: "BRL".into(),
            transactions,
            categories,
        }
    }

    // ── compute_categories ──

    #[test]
    fn categories_excludes_payments_and_transfers() {
        let txns = vec![
            make_transaction("1", -100.0, Some("Groceries"), "2026-03-01"),
            make_transaction("2", -50.0, Some("Credit card payment"), "2026-03-02"),
            make_transaction("3", -30.0, Some("Transfers"), "2026-03-03"),
        ];
        let cats = compute_categories(&txns);
        assert_eq!(cats.len(), 1);
        assert_eq!(cats[0].name, "Groceries");
        assert_eq!(cats[0].amount, 100.0);
    }

    #[test]
    fn categories_uses_abs_resolved_amount() {
        let txns = vec![
            make_transaction("1", -200.0, Some("Food"), "2026-03-01"),
            make_transaction("2", -150.0, Some("Food"), "2026-03-02"),
        ];
        let cats = compute_categories(&txns);
        assert_eq!(cats[0].amount, 350.0);
    }

    #[test]
    fn categories_null_becomes_unknown() {
        let txns = vec![make_transaction("1", -50.0, None, "2026-03-01")];
        let cats = compute_categories(&txns);
        assert_eq!(cats[0].name, "Unknown");
    }

    // ── merge_billing_cycles ──

    #[test]
    fn merge_combines_same_key_cycles() {
        let card1 = vec![make_cycle(
            "2026-03",
            "Mar 2026",
            vec![make_transaction("1", -100.0, Some("Food"), "2026-03-01")],
        )];
        let card2 = vec![make_cycle(
            "2026-03",
            "Mar 2026",
            vec![make_transaction("2", -50.0, Some("Food"), "2026-03-02")],
        )];

        let merged = merge_billing_cycles(vec![card1, card2]);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].transactions.len(), 2);
        assert_eq!(merged[0].total, -150.0);
    }

    #[test]
    fn merge_different_keys_stay_separate() {
        let card1 = vec![make_cycle(
            "2026-02",
            "Feb 2026",
            vec![make_transaction("1", -100.0, Some("Food"), "2026-02-01")],
        )];
        let card2 = vec![make_cycle(
            "2026-03",
            "Mar 2026",
            vec![make_transaction("2", -50.0, Some("Food"), "2026-03-01")],
        )];

        let merged = merge_billing_cycles(vec![card1, card2]);
        assert_eq!(merged.len(), 2);
        // Sorted by key descending
        assert_eq!(merged[0].key, "2026-03");
        assert_eq!(merged[1].key, "2026-02");
    }

    // ── spending_trend ──

    #[test]
    fn trend_returns_none_for_less_than_2_cycles() {
        let cycles = vec![make_cycle(
            "2026-03",
            "Mar 2026",
            vec![make_transaction("1", -100.0, Some("Food"), "2026-03-01")],
        )];
        assert!(spending_trend(&cycles).is_none());
    }

    #[test]
    fn trend_calculates_change_percentage() {
        let cycles = vec![
            make_cycle(
                "2026-02",
                "Feb 2026",
                vec![make_transaction("1", -100.0, Some("Food"), "2026-02-01")],
            ),
            make_cycle(
                "2026-03",
                "Mar 2026",
                vec![make_transaction("2", -120.0, Some("Food"), "2026-03-01")],
            ),
        ];
        let trend = spending_trend(&cycles).unwrap();
        assert_eq!(trend.data_points.len(), 2);
        assert_eq!(trend.current_total, 120.0);
        assert_eq!(trend.previous_total, 100.0);
        assert!((trend.change_percentage.unwrap() - 20.0).abs() < 0.1);
    }

    // ── spending_history ──

    #[test]
    fn history_returns_none_for_less_than_2() {
        let cycles = vec![make_cycle(
            "2026-03",
            "Mar 2026",
            vec![make_transaction("1", -100.0, Some("Food"), "2026-03-01")],
        )];
        assert!(spending_history(&cycles, 10).is_none());
    }

    #[test]
    fn history_returns_top_n_categories() {
        let cycles = vec![
            make_cycle(
                "2026-02",
                "Feb 2026",
                vec![
                    make_transaction("1", -200.0, Some("Food"), "2026-02-01"),
                    make_transaction("2", -100.0, Some("Transport"), "2026-02-02"),
                    make_transaction("3", -50.0, Some("Shopping"), "2026-02-03"),
                ],
            ),
            make_cycle(
                "2026-03",
                "Mar 2026",
                vec![
                    make_transaction("4", -150.0, Some("Food"), "2026-03-01"),
                    make_transaction("5", -80.0, Some("Transport"), "2026-03-02"),
                ],
            ),
        ];
        let history = spending_history(&cycles, 2).unwrap();
        assert_eq!(history.categories.len(), 2);
        assert_eq!(history.categories[0], "Food");
        assert_eq!(history.categories[1], "Transport");
    }
}
