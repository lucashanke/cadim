export interface HealthStatus {
  status: string
  message: string
}

export interface AccountsSummary {
  total_balance: number
  currency_code: string
  account_count: number
}

export interface InvestmentsSummary {
  total_gross_amount: number
  currency_code: string
  investment_count: number
}

export interface InvestmentPosition {
  id: string
  name: string
  investment_type: string
  subtype: string | null
  amount: number
  currency_code: string
  date: string | null
  due_date: string | null
  rate: number | null
  rate_type: string | null
  fixed_annual_rate: number | null
}

export interface ConnectedItem {
  id: string
  name: string
}

export interface ManualPosition {
  id: string
  investment_type: string
  subtype: string | null
  amount: number
  due_date: string | null
}

export type Page = 'dashboard' | 'investments'
