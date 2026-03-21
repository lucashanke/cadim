use serde::Serialize;

/// INSS progressive brackets (2026)
const INSS_BRACKETS: [(f64, f64); 4] = [
    (1621.0, 0.075),
    (2902.84, 0.09),
    (4354.27, 0.12),
    (8475.55, 0.14),
];

/// IRRF brackets (2026) — applied on (gross - INSS)
/// (ceiling, rate, deduction)
const IRRF_BRACKETS: [(f64, f64, f64); 5] = [
    (2428.80, 0.0, 0.0),
    (2826.65, 0.075, 182.16),
    (3751.05, 0.15, 394.16),
    (4664.68, 0.225, 675.49),
    (f64::INFINITY, 0.275, 908.73),
];

/// 2026 exemption: gross <= R$ 5,000 is fully exempt
const EXEMPTION_CEILING: f64 = 5000.0;
/// Gradual reduction applies between R$ 5,000–7,350
const REDUCTION_CEILING: f64 = 7350.0;
const REDUCTION_CONSTANT: f64 = 978.62;
const REDUCTION_FACTOR: f64 = 0.133145;

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

pub fn calculate_inss(gross: f64) -> f64 {
    let mut tax = 0.0;
    let mut prev = 0.0;

    for &(ceiling, rate) in &INSS_BRACKETS {
        if gross <= prev {
            break;
        }
        let taxable = gross.min(ceiling) - prev;
        tax += taxable * rate;
        prev = ceiling;
    }

    round2(tax)
}

fn calculate_irrf_from_table(taxable_base: f64) -> f64 {
    for &(ceiling, rate, deduction) in &IRRF_BRACKETS {
        if taxable_base <= ceiling {
            let tax = taxable_base * rate - deduction;
            return round2(tax.max(0.0));
        }
    }
    0.0
}

pub fn calculate_irrf(taxable_base: f64, gross_salary: Option<f64>) -> f64 {
    let gross = gross_salary.unwrap_or(taxable_base);
    if gross <= EXEMPTION_CEILING {
        return 0.0;
    }

    let tax = calculate_irrf_from_table(taxable_base);

    if gross <= REDUCTION_CEILING {
        let reduction = (REDUCTION_CONSTANT - REDUCTION_FACTOR * gross).max(0.0);
        return round2((tax - reduction).max(0.0));
    }

    tax
}

pub fn calculate_net_salary(gross: f64) -> f64 {
    let inss = calculate_inss(gross);
    let irrf = calculate_irrf(gross - inss, Some(gross));
    round2(gross - inss - irrf)
}

#[derive(Debug, Clone, Serialize)]
pub struct MonthlyIncome {
    pub gross_before_tax: f64,
    pub inss: f64,
    pub irrf: f64,
    pub other_deductions: f64,
    pub net_income: f64,
}

pub fn calculate_monthly_income(gross_salary: f64, other_deductions: f64) -> MonthlyIncome {
    let inss = calculate_inss(gross_salary);
    let irrf = calculate_irrf(gross_salary - inss, Some(gross_salary));
    let net_income = gross_salary - inss - irrf - other_deductions;

    MonthlyIncome {
        gross_before_tax: gross_salary,
        inss: round2(inss),
        irrf: round2(irrf),
        other_deductions: round2(other_deductions),
        net_income: round2(net_income),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AnnualBonuses {
    pub thirteenth_gross: f64,
    pub thirteenth_net: f64,
    pub vacation_third_gross: f64,
    pub vacation_third_net: f64,
    pub total_net: f64,
}

pub fn calculate_annual_bonuses(gross_salary: f64) -> AnnualBonuses {
    let thirteenth_gross = gross_salary;
    let thirteenth_net = calculate_net_salary(thirteenth_gross);

    let vacation_third_gross = round2(gross_salary / 3.0);
    let vacation_third_net = calculate_net_salary(vacation_third_gross);

    AnnualBonuses {
        thirteenth_gross,
        thirteenth_net,
        vacation_third_gross,
        vacation_third_net,
        total_net: round2(thirteenth_net + vacation_third_net),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64) -> bool {
        (a - b).abs() < 0.01
    }

    #[test]
    fn inss_first_bracket() {
        assert!(approx_eq(calculate_inss(1500.0), 1500.0 * 0.075));
    }

    #[test]
    fn inss_first_bracket_ceiling() {
        assert!(approx_eq(calculate_inss(1621.0), 1621.0 * 0.075));
    }

    #[test]
    fn inss_second_bracket() {
        let expected = 1621.0 * 0.075 + (2000.0 - 1621.0) * 0.09;
        assert!(approx_eq(calculate_inss(2000.0), expected));
    }

    #[test]
    fn inss_third_bracket() {
        let expected =
            1621.0 * 0.075 + (2902.84 - 1621.0) * 0.09 + (3500.0 - 2902.84) * 0.12;
        assert!(approx_eq(calculate_inss(3500.0), expected));
    }

    #[test]
    fn inss_fourth_bracket() {
        let expected = 1621.0 * 0.075
            + (2902.84 - 1621.0) * 0.09
            + (4354.27 - 2902.84) * 0.12
            + (5000.0 - 4354.27) * 0.14;
        assert!(approx_eq(calculate_inss(5000.0), expected));
    }

    #[test]
    fn inss_caps_at_ceiling() {
        let ceiling_contribution = 1621.0 * 0.075
            + (2902.84 - 1621.0) * 0.09
            + (4354.27 - 2902.84) * 0.12
            + (8475.55 - 4354.27) * 0.14;
        assert!(approx_eq(calculate_inss(8475.55), ceiling_contribution));
        assert!(approx_eq(calculate_inss(20000.0), ceiling_contribution));
        assert!(approx_eq(calculate_inss(50000.0), ceiling_contribution));
    }

    #[test]
    fn irrf_exempt_range() {
        assert_eq!(calculate_irrf(2000.0, None), 0.0);
        assert_eq!(calculate_irrf(2428.8, None), 0.0);
    }

    #[test]
    fn irrf_second_bracket_no_exemption() {
        let base = 2500.0;
        let expected = base * 0.075 - 182.16;
        assert!(approx_eq(calculate_irrf(base, Some(8000.0)), expected));
    }

    #[test]
    fn irrf_third_bracket_no_exemption() {
        let base = 3000.0;
        let expected = base * 0.15 - 394.16;
        assert!(approx_eq(calculate_irrf(base, Some(8000.0)), expected));
    }

    #[test]
    fn irrf_fourth_bracket_no_exemption() {
        let base = 4000.0;
        let expected = base * 0.225 - 675.49;
        assert!(approx_eq(calculate_irrf(base, Some(8000.0)), expected));
    }

    #[test]
    fn irrf_highest_bracket() {
        let base = 10000.0;
        let expected = base * 0.275 - 908.73;
        assert!(approx_eq(
            calculate_irrf(base, Some(15000.0)),
            expected
        ));
    }

    #[test]
    fn irrf_2026_exemption_up_to_5000() {
        assert_eq!(calculate_irrf(4500.0, Some(5000.0)), 0.0);
        assert_eq!(calculate_irrf(3500.0, Some(4000.0)), 0.0);
        assert_eq!(calculate_irrf(4000.0, Some(4500.0)), 0.0);
    }

    #[test]
    fn irrf_gradual_reduction() {
        let gross = 6000.0;
        let inss = calculate_inss(gross);
        let base = gross - inss;
        let no_exemption_tax = calculate_irrf(base, Some(8000.0));
        let reduction = (978.62 - 0.133145 * gross).max(0.0);
        let expected = (no_exemption_tax - reduction).max(0.0);
        assert!(approx_eq(calculate_irrf(base, Some(gross)), expected));
    }

    #[test]
    fn irrf_no_reduction_above_7350() {
        let gross = 10000.0;
        let inss = calculate_inss(gross);
        let base = gross - inss;
        let table_tax = base * 0.275 - 908.73;
        assert!(approx_eq(calculate_irrf(base, Some(gross)), table_tax));
    }

    #[test]
    fn reduction_reaches_zero_at_7350() {
        let reduction: f64 = 978.62 - 0.133145 * 7350.0;
        assert!(reduction.abs() < 0.01);
    }

    #[test]
    fn net_salary_known_gross() {
        let gross = 10000.0;
        let inss = calculate_inss(gross);
        let irrf = calculate_irrf(gross - inss, Some(gross));
        assert!(approx_eq(calculate_net_salary(gross), gross - inss - irrf));
    }

    #[test]
    fn net_salary_below_irrf_threshold() {
        let gross = 1500.0;
        let inss = calculate_inss(gross);
        assert!(approx_eq(calculate_net_salary(gross), gross - inss));
    }

    #[test]
    fn net_salary_5000_exemption() {
        let gross = 5000.0;
        let inss = calculate_inss(gross);
        assert!(approx_eq(calculate_net_salary(gross), gross - inss));
    }

    #[test]
    fn monthly_income_regular() {
        let gross = 10000.0;
        let result = calculate_monthly_income(gross, 0.0);
        assert_eq!(result.gross_before_tax, gross);
        assert!(result.inss > 0.0);
        assert!(result.irrf > 0.0);
        assert!(approx_eq(
            result.net_income,
            gross - result.inss - result.irrf
        ));
    }

    #[test]
    fn monthly_income_with_deductions() {
        let gross = 10000.0;
        let without = calculate_monthly_income(gross, 0.0);
        let with_ded = calculate_monthly_income(gross, 500.0);
        assert_eq!(with_ded.other_deductions, 500.0);
        assert!(approx_eq(
            with_ded.net_income,
            without.net_income - 500.0
        ));
        assert!(approx_eq(with_ded.inss, without.inss));
        assert!(approx_eq(with_ded.irrf, without.irrf));
    }

    #[test]
    fn monthly_income_5000_no_irrf() {
        let result = calculate_monthly_income(5000.0, 0.0);
        assert_eq!(result.irrf, 0.0);
    }

    #[test]
    fn annual_bonuses_thirteenth() {
        let gross = 10000.0;
        let bonuses = calculate_annual_bonuses(gross);
        assert_eq!(bonuses.thirteenth_gross, gross);
        assert_eq!(bonuses.thirteenth_net, calculate_net_salary(gross));
    }

    #[test]
    fn annual_bonuses_vacation_third() {
        let gross = 10000.0;
        let bonuses = calculate_annual_bonuses(gross);
        let vac_gross = round2(gross / 3.0);
        assert!(approx_eq(bonuses.vacation_third_gross, vac_gross));
        assert_eq!(bonuses.vacation_third_net, calculate_net_salary(vac_gross));
    }

    #[test]
    fn annual_bonuses_total() {
        let bonuses = calculate_annual_bonuses(10000.0);
        assert!(approx_eq(
            bonuses.total_net,
            bonuses.thirteenth_net + bonuses.vacation_third_net
        ));
    }

    #[test]
    fn annual_bonuses_low_salary() {
        let bonuses = calculate_annual_bonuses(1500.0);
        assert!(bonuses.thirteenth_net > 0.0);
        assert!(bonuses.thirteenth_net < 1500.0);
        assert!(bonuses.vacation_third_net > 0.0);
        assert!(bonuses.vacation_third_net < 500.0);
    }
}
