use serde::Serialize;

/// Format a position's rate for display.
/// Ports frontend/src/lib/investments.ts::formatRate
pub fn format_rate(
    rate: Option<f64>,
    rate_type: Option<&str>,
    fixed_annual_rate: Option<f64>,
) -> String {
    // Treat 0 as None for rate (matches JS `pos.rate || null`)
    let rate = rate.filter(|&r| r != 0.0);
    let fixed = fixed_annual_rate.filter(|&r| r != 0.0);

    if rate_type.is_none() && fixed.is_none() {
        return "—".into();
    }

    let mut parts = Vec::new();

    // Include rate% if rate is present with a rate_type,
    // but NOT when rate=100 and fixed_annual_rate is set
    if let (Some(r), Some(rt)) = (rate, rate_type) {
        let skip = r == 100.0 && fixed.is_some();
        if !skip {
            parts.push(format!("{}%", r));
        }
        parts.push(rt.to_string());
    } else if let Some(rt) = rate_type {
        parts.push(rt.to_string());
    }

    if !parts.is_empty() {
        if let Some(f) = fixed {
            return format!("{} + {}% a.a.", parts.join(" "), f);
        }
        return parts.join(" ");
    }

    if let Some(f) = fixed {
        return format!("{}% a.a.", f);
    }

    "—".into()
}

// ── Investment Type Labels & Colors ────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct InvestmentTypeInfo {
    pub label: &'static str,
    pub color: &'static str,
}

pub fn investment_type_label(type_key: &str) -> &'static str {
    match type_key {
        "MUTUAL_FUND" => "Mutual Fund",
        "SECURITY" => "Security",
        "EQUITY" => "Equity",
        "FIXED_INCOME" => "Fixed Income",
        "TREASURE" => "Treasury",
        "PENSION" => "Pension",
        "REAL_ESTATE_FUND" => "Real Estate",
        "ETF" => "ETF",
        "COE" => "COE",
        _ => "Other",
    }
}

pub fn investment_type_color(type_key: &str) -> &'static str {
    match type_key {
        "MUTUAL_FUND" => "#4080d0",
        "SECURITY" => "#8060e8",
        "EQUITY" => "#20a868",
        "FIXED_INCOME" => "#e09020",
        "TREASURE" => "#b89820",
        "PENSION" => "#cc5080",
        "REAL_ESTATE_FUND" => "#c87030",
        "ETF" => "#1898c0",
        "COE" => "#5c68f0",
        _ => "#6880a0",
    }
}

// ── Subtype Labels ─────────────────────────────────────────────────────

pub fn subtype_label(subtype: &str) -> String {
    match subtype {
        "CDB" => "CDB".into(),
        "LCI" => "LCI".into(),
        "LCA" => "LCA".into(),
        "CRI" => "CRI".into(),
        "CRA" => "CRA".into(),
        "DEBENTURE" => "Debênture".into(),
        "DEBENTURES" => "Debêntures".into(),
        "LC" => "LC".into(),
        "LIG" => "LIG".into(),
        "LF" => "LF".into(),
        "TREASURY" => "Tesouro".into(),
        "POUPANCA" => "Poupança".into(),
        "TESOURO_SELIC" => "Tesouro Selic".into(),
        "TESOURO_IPCA" => "Tesouro IPCA+".into(),
        "TESOURO_PREFIXADO" => "Tesouro Pré".into(),
        "STOCK" | "STOCKS" => "Ações".into(),
        "BDR" => "BDR".into(),
        "REAL_ESTATE_FUND" => "FII".into(),
        "DERIVATIVES" => "Derivativos".into(),
        "OPTION" => "Opção".into(),
        "FII" => "FII".into(),
        "ETF" => "ETF".into(),
        "ETF_FUND" => "ETF Fund".into(),
        "INVESTMENT_FUND" => "Fundo de Invest.".into(),
        "STOCK_FUND" => "Fundo de Ações".into(),
        "MULTIMARKET_FUND" | "FUNDO_MULTIMERCADO" => "Multimercado".into(),
        "EXCHANGE_FUND" => "Fundo Cambial".into(),
        "FIXED_INCOME_FUND" | "FUNDO_RENDA_FIXA" => "Renda Fixa".into(),
        "FIP_FUND" => "FIP".into(),
        "OFFSHORE_FUND" => "Offshore".into(),
        "FUNDO_ACOES" => "Fundo de Ações".into(),
        "RETIREMENT" => "Previdência".into(),
        "PGBL" => "PGBL".into(),
        "VGBL" => "VGBL".into(),
        "COE" => "COE".into(),
        "STRUCTURED_NOTE" => "Nota Estruturada".into(),
        other => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_rate_no_info() {
        assert_eq!(format_rate(None, None, None), "—");
    }

    #[test]
    fn format_rate_cdi_100() {
        assert_eq!(format_rate(Some(100.0), Some("CDI"), None), "100% CDI");
    }

    #[test]
    fn format_rate_cdi_100_with_spread() {
        // When rate=100 and fixed_annual_rate is set, omit the "100%"
        assert_eq!(
            format_rate(Some(100.0), Some("CDI"), Some(2.5)),
            "CDI + 2.5% a.a."
        );
    }

    #[test]
    fn format_rate_cdi_partial_with_spread() {
        assert_eq!(
            format_rate(Some(80.0), Some("CDI"), Some(1.0)),
            "80% CDI + 1% a.a."
        );
    }

    #[test]
    fn format_rate_ipca_with_spread() {
        assert_eq!(
            format_rate(None, Some("IPCA"), Some(6.0)),
            "IPCA + 6% a.a."
        );
    }

    #[test]
    fn format_rate_fixed_only() {
        assert_eq!(format_rate(None, None, Some(12.0)), "12% a.a.");
    }

    #[test]
    fn format_rate_prefixado() {
        assert_eq!(
            format_rate(None, Some("PREFIXADO"), Some(12.0)),
            "PREFIXADO + 12% a.a."
        );
    }

    #[test]
    fn format_rate_type_only() {
        assert_eq!(format_rate(None, Some("CDI"), None), "CDI");
    }

    // ── Labels & Colors ──

    #[test]
    fn type_labels_known() {
        assert_eq!(investment_type_label("FIXED_INCOME"), "Fixed Income");
        assert_eq!(investment_type_label("EQUITY"), "Equity");
        assert_eq!(investment_type_label("UNKNOWN"), "Other");
    }

    #[test]
    fn type_colors_known() {
        assert_eq!(investment_type_color("FIXED_INCOME"), "#e09020");
        assert_eq!(investment_type_color("EQUITY"), "#20a868");
        assert_eq!(investment_type_color("UNKNOWN"), "#6880a0");
    }

    #[test]
    fn subtype_labels_known() {
        assert_eq!(subtype_label("CDB"), "CDB");
        assert_eq!(subtype_label("TESOURO_SELIC"), "Tesouro Selic");
        assert_eq!(subtype_label("UNKNOWN_SUB"), "UNKNOWN_SUB");
    }
}
