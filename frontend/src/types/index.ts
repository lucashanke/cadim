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
  resolved_amount: number
  transaction_type: string
  card_last_four: string | null
}

export interface CategoryTotal {
  name: string
  amount: number
}

export interface BillingCycle {
  key: string
  label: string
  total: number
  currency_code: string
  transactions: TransactionItem[]
  categories: CategoryTotal[]
}
