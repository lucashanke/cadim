use chrono::{Datelike, NaiveDate};
use serde::Serialize;

use super::taxes::{calculate_annual_bonuses, calculate_monthly_income};

/// Investment types that don't grow (flat projection).
const FLAT_TYPES: &[&str] = &["EQUITY", "MUTUAL_FUND", "ETF", "COE", "OTHER"];

fn annual_to_monthly(annual_percent: f64) -> f64 {
    (1.0 + annual_percent / 100.0).powf(1.0 / 12.0) - 1.0
}

#[derive(Debug, Clone)]
pub struct Position {
    pub amount: f64,
    pub investment_type: String,
    pub rate: Option<f64>,
    pub rate_type: Option<String>,
    pub fixed_annual_rate: Option<f64>,
    pub due_date: Option<NaiveDate>,
}

/// Project a single position's value at a future month date.
pub fn project_position(
    pos: &Position,
    month_date: NaiveDate,
    cdi_annual: f64,
    ipca_annual: f64,
    today: NaiveDate,
) -> f64 {
    if FLAT_TYPES.iter().any(|&t| t == pos.investment_type) {
        return pos.amount;
    }

    let past_maturity = pos
        .due_date
        .map(|d| month_date > d)
        .unwrap_or(false);
    let no_rate_info = pos.rate_type.is_none() && pos.fixed_annual_rate.is_none();

    let effective_annual = if past_maturity || no_rate_info {
        cdi_annual
    } else if pos.rate_type.as_deref() == Some("CDI") {
        let rate_pct = pos.rate.unwrap_or(100.0);
        let cdi_portion = cdi_annual * (rate_pct / 100.0);
        cdi_portion + pos.fixed_annual_rate.unwrap_or(0.0)
    } else if pos.rate_type.as_deref() == Some("IPCA") {
        ipca_annual + pos.fixed_annual_rate.unwrap_or(0.0)
    } else {
        // PREFIXADO or fixed-only
        pos.fixed_annual_rate.unwrap_or(0.0)
    };

    if effective_annual == 0.0 {
        return pos.amount;
    }

    let months_ahead =
        (month_date.year() - today.year()) * 12 + (month_date.month() as i32 - today.month() as i32);

    if months_ahead <= 0 {
        return pos.amount;
    }

    let monthly_rate = annual_to_monthly(effective_annual);
    pos.amount * (1.0 + monthly_rate).powi(months_ahead)
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectionDataPoint {
    pub month: String,
    pub label: String,
    pub total: f64,
    pub savings: f64,
    pub investments: f64,
    pub compound_interest: f64,
}

pub struct ProjectionParams {
    pub positions: Vec<Position>,
    pub accounts_balance: f64,
    pub cdi_annual: f64,
    pub ipca_annual: f64,
    pub gross_salary: f64,
    pub avg_monthly_expenses: f64,
    pub other_deductions: f64,
    pub thirteenth_received: f64,
    pub vacation_third_received: f64,
    pub compound_savings: bool,
}

const MONTH_LABELS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

fn days_in_month(year: i32, month: u32) -> u32 {
    // Get the first day of next month, then subtract one day
    if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }
    .unwrap()
    .pred_opt()
    .unwrap()
    .day()
}

pub fn project_net_worth(params: &ProjectionParams, today: NaiveDate) -> Vec<ProjectionDataPoint> {
    let start_month = today.month0(); // 0-based
    let start_year = today.year();
    let today_day = today.day();

    let cdi_monthly = if params.compound_savings {
        annual_to_monthly(params.cdi_annual)
    } else {
        0.0
    };

    let mut savings = params.accounts_balance;
    let mut savings_base = params.accounts_balance;

    let base_investments: f64 = params.positions.iter().map(|p| p.amount).sum();

    // Compute remaining bonuses for current-year December only
    let (thirteenth_remaining, vacation_third_remaining) = if params.gross_salary > 0.0 {
        let bonuses = calculate_annual_bonuses(params.gross_salary);
        (
            (bonuses.thirteenth_net - params.thirteenth_received).max(0.0),
            (bonuses.vacation_third_net - params.vacation_third_received).max(0.0),
        )
    } else {
        (0.0, 0.0)
    };

    let mut points = Vec::with_capacity(13);

    for i in 0..=12u32 {
        let total_month = start_month + i;
        let year = start_year + (total_month / 12) as i32;
        let m = total_month % 12; // 0-based month
        let month_1based = m + 1;
        let month_date = NaiveDate::from_ymd_opt(year, month_1based, 15).unwrap();
        let month_key = format!("{}-{:02}", year, month_1based);
        let label = format!("{} {}", MONTH_LABELS[m as usize], year);
        let is_current_month = i == 0;
        let is_current_year_december = m == 11 && year == start_year;

        if is_current_month {
            let dim = days_in_month(year, month_1based);

            let mut pending_income = 0.0;
            if params.gross_salary > 0.0 {
                let income =
                    calculate_monthly_income(params.gross_salary, params.other_deductions);
                let advance = params.gross_salary * 0.5;
                let remainder = income.net_income - advance;

                if today_day < 15 {
                    pending_income = income.net_income;
                } else if today_day < dim {
                    pending_income = remainder;
                }

                if is_current_year_december {
                    pending_income += thirteenth_remaining + vacation_third_remaining;
                }
            }

            let days_left = dim - today_day;
            let remaining_expenses =
                params.avg_monthly_expenses * (days_left as f64 / dim as f64);

            let contribution = pending_income - remaining_expenses;
            savings += contribution;
            savings_base += contribution;
        } else {
            let mut contribution = -params.avg_monthly_expenses;
            if params.gross_salary > 0.0 {
                let income =
                    calculate_monthly_income(params.gross_salary, params.other_deductions);
                contribution += income.net_income;
                if is_current_year_december {
                    contribution += thirteenth_remaining + vacation_third_remaining;
                }
            }
            savings += contribution;
            savings_base += contribution;
            if params.compound_savings {
                savings *= 1.0 + cdi_monthly;
            }
        }

        let mut investments_total = 0.0;
        for pos in &params.positions {
            if is_current_month {
                investments_total += pos.amount;
            } else {
                investments_total +=
                    project_position(pos, month_date, params.cdi_annual, params.ipca_annual, today);
            }
        }

        let compound_interest =
            (savings - savings_base) + (investments_total - base_investments);
        let total = savings + investments_total;

        points.push(ProjectionDataPoint {
            month: month_key,
            label,
            total,
            savings: savings_base,
            investments: base_investments,
            compound_interest,
        });
    }

    points
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_position(overrides: Option<PositionOverrides>) -> Position {
        let o = overrides.unwrap_or_default();
        Position {
            amount: o.amount.unwrap_or(10000.0),
            investment_type: o.investment_type.unwrap_or_else(|| "FIXED_INCOME".into()),
            rate: o.rate,
            rate_type: o.rate_type,
            fixed_annual_rate: o.fixed_annual_rate,
            due_date: o.due_date,
        }
    }

    #[derive(Default)]
    struct PositionOverrides {
        amount: Option<f64>,
        investment_type: Option<String>,
        rate: Option<f64>,
        rate_type: Option<String>,
        fixed_annual_rate: Option<f64>,
        due_date: Option<NaiveDate>,
    }

    fn today() -> NaiveDate {
        chrono::Local::now().date_naive()
    }

    fn future_date(months_ahead: i32) -> NaiveDate {
        let t = today();
        let total_months = t.month0() as i32 + months_ahead;
        let year = t.year() + total_months.div_euclid(12);
        let month = (total_months.rem_euclid(12) + 1) as u32;
        NaiveDate::from_ymd_opt(year, month, 15).unwrap()
    }

    fn default_params() -> ProjectionParams {
        ProjectionParams {
            positions: vec![],
            accounts_balance: 0.0,
            cdi_annual: 0.0,
            ipca_annual: 0.0,
            gross_salary: 0.0,
            avg_monthly_expenses: 0.0,
            other_deductions: 0.0,
            thirteenth_received: 0.0,
            vacation_third_received: 0.0,
            compound_savings: false,
        }
    }

    // ── projectPosition tests ──

    #[test]
    fn projects_cdi_position() {
        let pos = make_position(Some(PositionOverrides {
            rate: Some(100.0),
            rate_type: Some("CDI".into()),
            fixed_annual_rate: Some(0.0),
            ..Default::default()
        }));
        let result = project_position(&pos, future_date(6), 13.25, 5.0, today());
        assert!(result > 10000.0);
        assert!(result < 11000.0);
    }

    #[test]
    fn projects_cdi_with_partial_rate() {
        let pos = make_position(Some(PositionOverrides {
            rate: Some(80.0),
            rate_type: Some("CDI".into()),
            fixed_annual_rate: Some(1.0),
            ..Default::default()
        }));
        let result = project_position(&pos, future_date(6), 13.25, 5.0, today());
        assert!(result > 10000.0);
        assert!(result < 10700.0);
    }

    #[test]
    fn projects_ipca_position() {
        let pos = make_position(Some(PositionOverrides {
            rate_type: Some("IPCA".into()),
            fixed_annual_rate: Some(6.0),
            ..Default::default()
        }));
        let result = project_position(&pos, future_date(6), 13.25, 5.0, today());
        assert!(result > 10000.0);
        assert!(result < 10700.0);
    }

    #[test]
    fn projects_prefixado() {
        let pos = make_position(Some(PositionOverrides {
            rate_type: Some("PREFIXADO".into()),
            fixed_annual_rate: Some(12.0),
            ..Default::default()
        }));
        let result = project_position(&pos, future_date(6), 13.25, 5.0, today());
        assert!(result > 10000.0);
        assert!(result < 10700.0);
    }

    #[test]
    fn keeps_equity_flat() {
        let pos = make_position(Some(PositionOverrides {
            investment_type: Some("EQUITY".into()),
            amount: Some(5000.0),
            ..Default::default()
        }));
        assert_eq!(project_position(&pos, future_date(6), 13.25, 5.0, today()), 5000.0);
    }

    #[test]
    fn keeps_etf_flat() {
        let pos = make_position(Some(PositionOverrides {
            investment_type: Some("ETF".into()),
            amount: Some(3000.0),
            ..Default::default()
        }));
        assert_eq!(project_position(&pos, future_date(6), 13.25, 5.0, today()), 3000.0);
    }

    #[test]
    fn matured_position_uses_cdi() {
        let past = today() - chrono::Duration::days(30);
        let pos = make_position(Some(PositionOverrides {
            rate: Some(100.0),
            rate_type: Some("CDI".into()),
            fixed_annual_rate: Some(0.0),
            due_date: Some(past),
            ..Default::default()
        }));
        let result = project_position(&pos, future_date(6), 13.25, 5.0, today());
        assert!(result > 10000.0);
        assert!(result < 11000.0);
    }

    #[test]
    fn returns_amount_for_current_month() {
        let pos = make_position(Some(PositionOverrides {
            rate: Some(100.0),
            rate_type: Some("CDI".into()),
            fixed_annual_rate: Some(0.0),
            ..Default::default()
        }));
        assert_eq!(project_position(&pos, today(), 13.25, 5.0, today()), 10000.0);
    }

    #[test]
    fn no_rate_info_uses_cdi() {
        let pos = make_position(None);
        let result = project_position(&pos, future_date(6), 13.25, 5.0, today());
        assert!(result > 10000.0);
        assert!(result < 11000.0);
    }

    // ── projectNetWorth tests ──

    #[test]
    fn returns_13_data_points() {
        let mut params = default_params();
        params.accounts_balance = 10000.0;
        params.cdi_annual = 13.25;
        params.ipca_annual = 5.0;
        let points = project_net_worth(&params, today());
        assert_eq!(points.len(), 13);
        assert!(points[0].total > 9000.0);
    }

    #[test]
    fn includes_investment_growth() {
        let pos = make_position(Some(PositionOverrides {
            rate: Some(100.0),
            rate_type: Some("CDI".into()),
            fixed_annual_rate: Some(0.0),
            amount: Some(100000.0),
            ..Default::default()
        }));
        let mut params = default_params();
        params.positions = vec![pos];
        params.cdi_annual = 13.25;
        params.ipca_annual = 5.0;
        let points = project_net_worth(&params, today());
        assert!((points[0].total - 100000.0).abs() < 100.0);
        assert!(points.last().unwrap().total > 100000.0);
    }

    #[test]
    fn includes_accounts_balance() {
        let mut params = default_params();
        params.accounts_balance = 20000.0;
        params.cdi_annual = 13.25;
        params.ipca_annual = 5.0;
        let points = project_net_worth(&params, today());
        assert!(points[0].total > 19900.0);
    }

    #[test]
    fn proper_month_labels() {
        let params = default_params();
        let points = project_net_worth(&params, today());
        // month format: YYYY-MM
        assert!(points[0].month.len() == 7);
        assert!(points[0].month.contains('-'));
        // label format: "Mon YYYY"
        assert!(points[0].label.contains(' '));
    }

    #[test]
    fn salary_with_expenses_grows() {
        let mut params = default_params();
        params.accounts_balance = 10000.0;
        params.cdi_annual = 13.25;
        params.ipca_annual = 5.0;
        params.gross_salary = 10000.0;
        params.avg_monthly_expenses = 5000.0;
        params.compound_savings = true;
        let points = project_net_worth(&params, today());
        assert!(points[1].total > points[0].total);
        assert!(points[2].total > points[1].total);
    }

    #[test]
    fn compound_interest_grows_over_time() {
        let mut params = default_params();
        params.cdi_annual = 13.25;
        params.ipca_annual = 5.0;
        params.gross_salary = 10000.0;
        params.avg_monthly_expenses = 3000.0;
        params.compound_savings = true;
        let points = project_net_worth(&params, today());
        assert!(points[2].compound_interest > points[1].compound_interest);
    }

    #[test]
    fn no_compound_savings_no_growth() {
        let mut params = default_params();
        params.accounts_balance = 10000.0;
        params.cdi_annual = 13.25;
        params.ipca_annual = 5.0;
        params.compound_savings = false;
        let points = project_net_worth(&params, today());
        assert_eq!(points[0].total, 10000.0);
        assert_eq!(points[1].total, 10000.0);
        assert_eq!(points[1].compound_interest, 0.0);
    }

    #[test]
    fn compound_savings_grows_balance() {
        let mut params = default_params();
        params.accounts_balance = 10000.0;
        params.cdi_annual = 13.25;
        params.ipca_annual = 5.0;
        params.compound_savings = true;
        let points = project_net_worth(&params, today());
        assert_eq!(points[0].savings, 10000.0);
        assert_eq!(points[0].compound_interest, 0.0);
        assert_eq!(points[1].savings, 10000.0);
        assert!(points[1].compound_interest > 0.0);
        assert!(points[1].total > points[0].total);
    }

    #[test]
    fn expenses_deducted_without_salary() {
        let mut params = default_params();
        params.accounts_balance = 10000.0;
        params.avg_monthly_expenses = 1000.0;
        let points = project_net_worth(&params, today());
        assert!(points[1].total < points[0].total);
    }

    #[test]
    fn current_month_partial_income() {
        let t = today();
        let today_day = t.day();
        let dim = days_in_month(t.year(), t.month());

        let mut params = default_params();
        params.gross_salary = 10000.0;
        let points = project_net_worth(&params, t);

        let income = calculate_monthly_income(10000.0, 0.0);
        let advance = 10000.0 * 0.5;
        let remainder = income.net_income - advance;

        let expected_pending = if today_day < 15 {
            income.net_income
        } else if today_day < dim {
            remainder
        } else {
            0.0
        };

        assert!((points[0].savings - expected_pending).abs() < 1.0);
    }

    #[test]
    fn december_has_higher_income_from_bonuses() {
        let t = today();
        if t.month0() > 10 {
            return; // skip in Nov/Dec
        }

        let mut params = default_params();
        params.gross_salary = 10000.0;
        params.avg_monthly_expenses = 5000.0;
        let points = project_net_worth(&params, t);

        let oct_idx = (9 - t.month0()) as usize;
        let dec_idx = (11 - t.month0()) as usize;
        if oct_idx > 0 && dec_idx < points.len() {
            let oct_surplus = points[oct_idx].savings - points[oct_idx - 1].savings;
            let dec_surplus = points[dec_idx].savings - points[dec_idx - 1].savings;
            assert!(dec_surplus > oct_surplus);
        }
    }
}
