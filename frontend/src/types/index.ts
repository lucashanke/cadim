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

export type Page = 'dashboard' | 'investments' | 'credit-cards'

export interface CreditCardAccount {
  id: string
  name: string
  balance: number
  currency_code: string
  credit_limit: number | null
  available_credit_limit: number | null
  bill_due_date: string | null
  minimum_payment: number | null
}

export interface TransactionItem {
  id: string
  description: string
  amount: number
  currency_code: string
  date: string
  category: string | null
  amount_in_account_currency: number | null
  transaction_type: string
  card_last_four: string | null
}

export interface TransactionsResponse {
  results: TransactionItem[]
  total: number
  total_pages: number
  page: number
}
