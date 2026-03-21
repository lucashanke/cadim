use chrono::NaiveDate;
use serde::Serialize;

use super::investments::{investment_type_color, investment_type_label};

/// A position used for portfolio aggregation.
#[derive(Debug, Clone)]
pub struct PortfolioPosition {
    pub id: String,
    pub name: String,
    pub investment_type: String,
    pub subtype: Option<String>,
    pub amount: f64,
    pub due_date: Option<NaiveDate>,
    pub is_manual: bool,
}

// ── Net Worth Composition ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct CompositionSegment {
    pub type_key: String,
    pub label: String,
    pub amount: f64,
    pub percentage: f64,
    pub color: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NetWorthComposition {
    pub total: f64,
    pub segments: Vec<CompositionSegment>,
}

pub fn net_worth_composition(
    accounts_balance: f64,
    positions: &[PortfolioPosition],
) -> Option<NetWorthComposition> {
    let investments_total: f64 = positions.iter().map(|p| p.amount).sum();
    let total = accounts_balance + investments_total;
    if total <= 0.0 {
        return None;
    }

    let mut segments = Vec::new();

    if accounts_balance > 0.0 {
        segments.push(CompositionSegment {
            type_key: "Accounts".into(),
            label: "Accounts".into(),
            amount: accounts_balance,
            percentage: (accounts_balance / total) * 100.0,
            color: "hsl(var(--primary))".into(),
        });
    }

    // Group positions by investment_type
    let mut grouped = std::collections::HashMap::<String, f64>::new();
    for pos in positions {
        *grouped.entry(pos.investment_type.clone()).or_default() += pos.amount;
    }
    let mut type_amounts: Vec<(String, f64)> = grouped.into_iter().collect();
    type_amounts.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    for (type_key, amount) in type_amounts {
        segments.push(CompositionSegment {
            label: investment_type_label(&type_key).to_string(),
            percentage: (amount / total) * 100.0,
            color: investment_type_color(&type_key).to_string(),
            type_key,
            amount,
        });
    }

    Some(NetWorthComposition { total, segments })
}

// ── Portfolio Allocation ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SubtypeEntry {
    pub subtype_key: String,
    pub label: String,
    pub amount: f64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AllocationEntry {
    pub type_key: String,
    pub label: String,
    pub amount: f64,
    pub percentage: f64,
    pub color: String,
    pub subtypes: Vec<SubtypeEntry>,
}

pub fn portfolio_allocation(positions: &[PortfolioPosition]) -> Vec<AllocationEntry> {
    if positions.is_empty() {
        return vec![];
    }

    let total: f64 = positions.iter().map(|p| p.amount).sum();
    if total <= 0.0 {
        return vec![];
    }

    // Group by type, then subtypes within each type
    let mut type_map: std::collections::HashMap<String, (f64, std::collections::HashMap<String, f64>)> =
        std::collections::HashMap::new();

    for pos in positions {
        let entry = type_map
            .entry(pos.investment_type.clone())
            .or_insert_with(|| (0.0, std::collections::HashMap::new()));
        entry.0 += pos.amount;
        if let Some(ref sub) = pos.subtype {
            *entry.1.entry(sub.clone()).or_default() += pos.amount;
        }
    }

    let mut entries: Vec<AllocationEntry> = type_map
        .into_iter()
        .map(|(type_key, (amount, subtypes_map))| {
            let mut subtypes: Vec<SubtypeEntry> = subtypes_map
                .into_iter()
                .map(|(subtype_key, sub_amount)| SubtypeEntry {
                    label: subtype_key.clone(),
                    percentage: if amount > 0.0 {
                        (sub_amount / amount) * 100.0
                    } else {
                        0.0
                    },
                    subtype_key,
                    amount: sub_amount,
                })
                .collect();
            subtypes.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap());

            AllocationEntry {
                label: investment_type_label(&type_key).to_string(),
                percentage: (amount / total) * 100.0,
                color: investment_type_color(&type_key).to_string(),
                type_key,
                amount,
                subtypes,
            }
        })
        .collect();

    entries.sort_by(|a, b| b.amount.partial_cmp(&a.amount).unwrap());
    entries
}

// ── Attention Items ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct AttentionItem {
    pub id: String,
    pub label: String,
    pub amount: f64,
    pub urgency: String, // "red" or "amber"
    pub detail: String,
}

pub fn attention_items(positions: &[PortfolioPosition], today: NaiveDate) -> Vec<AttentionItem> {
    let window_end = today + chrono::Duration::days(60);

    let mut items: Vec<AttentionItem> = positions
        .iter()
        .filter_map(|pos| {
            let due = pos.due_date?;
            if due > window_end {
                return None;
            }
            let days_left = (due - today).num_days();
            Some(AttentionItem {
                id: pos.id.clone(),
                label: pos.name.clone(),
                amount: pos.amount,
                urgency: if days_left <= 0 {
                    "red".into()
                } else {
                    "amber".into()
                },
                detail: if days_left <= 0 {
                    "Matured".into()
                } else {
                    format!("{}d to maturity", days_left)
                },
            })
        })
        .collect();

    // Sort: red first, then amber
    items.sort_by(|a, b| {
        let a_priority = if a.urgency == "red" { 0 } else { 1 };
        let b_priority = if b.urgency == "red" { 0 } else { 1 };
        a_priority.cmp(&b_priority)
    });

    items.truncate(5);
    items
}

// ── Maturity Groups ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct MaturityGroup {
    pub label: String,
    pub total: f64,
    pub count: usize,
    pub percentage: f64,
}

const MS_PER_MONTH: f64 = 1000.0 * 60.0 * 60.0 * 24.0 * 30.44;

pub fn maturity_groups(positions: &[PortfolioPosition], today: NaiveDate) -> Vec<MaturityGroup> {
    let labels = [
        "Matured",
        "< 6 months",
        "6–12 months",
        "1–2 years",
        "2–5 years",
        "5+ years",
        "No due date",
    ];

    let mut groups: Vec<(f64, usize)> = vec![(0.0, 0); 7];

    for pos in positions {
        match pos.due_date {
            None => {
                groups[6].0 += pos.amount;
                groups[6].1 += 1;
            }
            Some(due) => {
                let diff_days = (due - today).num_days() as f64;
                let diff_months = diff_days * 1000.0 * 60.0 * 60.0 * 24.0 / MS_PER_MONTH;
                let idx = if diff_months <= 0.0 {
                    0
                } else if diff_months <= 6.0 {
                    1
                } else if diff_months <= 12.0 {
                    2
                } else if diff_months <= 24.0 {
                    3
                } else if diff_months <= 60.0 {
                    4
                } else {
                    5
                };
                groups[idx].0 += pos.amount;
                groups[idx].1 += 1;
            }
        }
    }

    let total: f64 = positions.iter().map(|p| p.amount).sum();

    labels
        .iter()
        .enumerate()
        .filter(|&(i, _)| groups[i].1 > 0)
        .map(|(i, &label)| MaturityGroup {
            label: label.to_string(),
            total: groups[i].0,
            count: groups[i].1,
            percentage: if total > 0.0 {
                (groups[i].0 / total) * 100.0
            } else {
                0.0
            },
        })
        .collect()
}

// ── Investment KPIs ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct InvestmentKpis {
    pub total_portfolio: f64,
    pub fixed_income: f64,
    pub fixed_income_pct: f64,
    pub variable_income: f64,
    pub variable_income_pct: f64,
    pub manual_total: f64,
    pub manual_count: usize,
    pub position_count: usize,
}

pub fn investment_kpis(positions: &[PortfolioPosition]) -> InvestmentKpis {
    let total: f64 = positions.iter().map(|p| p.amount).sum();

    let fixed_income: f64 = positions
        .iter()
        .filter(|p| p.investment_type == "FIXED_INCOME" || p.investment_type == "TREASURE")
        .map(|p| p.amount)
        .sum();

    let variable_income: f64 = positions
        .iter()
        .filter(|p| {
            matches!(
                p.investment_type.as_str(),
                "EQUITY" | "MUTUAL_FUND" | "ETF"
            )
        })
        .map(|p| p.amount)
        .sum();

    let manual_total: f64 = positions
        .iter()
        .filter(|p| p.is_manual)
        .map(|p| p.amount)
        .sum();
    let manual_count = positions.iter().filter(|p| p.is_manual).count();

    InvestmentKpis {
        total_portfolio: total,
        fixed_income,
        fixed_income_pct: if total > 0.0 {
            (fixed_income / total) * 100.0
        } else {
            0.0
        },
        variable_income,
        variable_income_pct: if total > 0.0 {
            (variable_income / total) * 100.0
        } else {
            0.0
        },
        manual_total,
        manual_count,
        position_count: positions.len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_pos(
        id: &str,
        name: &str,
        inv_type: &str,
        amount: f64,
        due_date: Option<NaiveDate>,
        is_manual: bool,
    ) -> PortfolioPosition {
        PortfolioPosition {
            id: id.into(),
            name: name.into(),
            investment_type: inv_type.into(),
            subtype: None,
            amount,
            due_date,
            is_manual,
        }
    }

    fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 3, 21).unwrap()
    }

    // ── net_worth_composition ──

    #[test]
    fn composition_returns_none_when_empty() {
        assert!(net_worth_composition(0.0, &[]).is_none());
    }

    #[test]
    fn composition_includes_accounts_and_investments() {
        let positions = vec![
            make_pos("1", "CDB", "FIXED_INCOME", 5000.0, None, false),
            make_pos("2", "Stock", "EQUITY", 3000.0, None, false),
        ];
        let comp = net_worth_composition(2000.0, &positions).unwrap();
        assert_eq!(comp.total, 10000.0);
        assert_eq!(comp.segments.len(), 3); // Accounts + 2 types
        assert_eq!(comp.segments[0].type_key, "Accounts");
    }

    // ── portfolio_allocation ──

    #[test]
    fn allocation_groups_by_type() {
        let positions = vec![
            make_pos("1", "A", "FIXED_INCOME", 7000.0, None, false),
            make_pos("2", "B", "EQUITY", 3000.0, None, false),
        ];
        let alloc = portfolio_allocation(&positions);
        assert_eq!(alloc.len(), 2);
        assert_eq!(alloc[0].type_key, "FIXED_INCOME");
        assert!((alloc[0].percentage - 70.0).abs() < 0.1);
    }

    #[test]
    fn allocation_empty_returns_empty() {
        assert!(portfolio_allocation(&[]).is_empty());
    }

    // ── attention_items ──

    #[test]
    fn attention_items_within_60_days() {
        let t = today();
        let positions = vec![
            make_pos("1", "Maturing", "FIXED_INCOME", 1000.0, Some(t + chrono::Duration::days(30)), false),
            make_pos("2", "Far", "FIXED_INCOME", 2000.0, Some(t + chrono::Duration::days(90)), false),
            make_pos("3", "Matured", "FIXED_INCOME", 500.0, Some(t - chrono::Duration::days(5)), false),
        ];
        let items = attention_items(&positions, t);
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].urgency, "red"); // matured first
        assert_eq!(items[1].urgency, "amber");
    }

    #[test]
    fn attention_items_limited_to_5() {
        let t = today();
        let positions: Vec<_> = (0..10)
            .map(|i| {
                make_pos(
                    &i.to_string(),
                    "Pos",
                    "FIXED_INCOME",
                    100.0,
                    Some(t + chrono::Duration::days(i * 5)),
                    false,
                )
            })
            .collect();
        assert_eq!(attention_items(&positions, t).len(), 5);
    }

    // ── maturity_groups ──

    #[test]
    fn maturity_groups_buckets() {
        let t = today();
        let positions = vec![
            make_pos("1", "Matured", "FI", 100.0, Some(t - chrono::Duration::days(10)), false),
            make_pos("2", "Soon", "FI", 200.0, Some(t + chrono::Duration::days(90)), false),
            make_pos("3", "NoDue", "FI", 300.0, None, false),
        ];
        let groups = maturity_groups(&positions, t);
        assert_eq!(groups.len(), 3);
        assert_eq!(groups[0].label, "Matured");
        assert_eq!(groups[0].count, 1);
        assert_eq!(groups[2].label, "No due date");
    }

    // ── investment_kpis ──

    #[test]
    fn kpis_calculated_correctly() {
        let positions = vec![
            make_pos("1", "CDB", "FIXED_INCOME", 6000.0, None, false),
            make_pos("2", "Tesouro", "TREASURE", 2000.0, None, false),
            make_pos("3", "Stock", "EQUITY", 1000.0, None, false),
            make_pos("4", "Manual", "FIXED_INCOME", 1000.0, None, true),
        ];
        let kpis = investment_kpis(&positions);
        assert_eq!(kpis.total_portfolio, 10000.0);
        assert_eq!(kpis.fixed_income, 9000.0); // 6000 + 2000 + 1000(manual FI)
        assert_eq!(kpis.variable_income, 1000.0);
        assert_eq!(kpis.manual_total, 1000.0);
        assert_eq!(kpis.manual_count, 1);
        assert_eq!(kpis.position_count, 4);
        assert!((kpis.fixed_income_pct - 90.0).abs() < 0.1);
    }

    #[test]
    fn kpis_empty_positions() {
        let kpis = investment_kpis(&[]);
        assert_eq!(kpis.total_portfolio, 0.0);
        assert_eq!(kpis.fixed_income_pct, 0.0);
    }
}
