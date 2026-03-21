const API_BASE = ''

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    throw new UnauthorizedError()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

// Auth
export function login(email: string, password: string) {
  return apiFetch<{ id: string; email: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function register(email: string, password: string) {
  return apiFetch<{ id: string; email: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function getMe() {
  return apiFetch<{ id: string; email: string }>('/api/auth/me')
}

// Positions
export interface ApiPosition {
  id: string
  user_id: string
  investment_type: string
  subtype: string | null
  amount: number
  due_date: string | null
}

export function createPosition(data: {
  investment_type: string
  subtype: string | null
  amount: number
  due_date: string | null
}) {
  return apiFetch<ApiPosition>('/api/positions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updatePosition(id: string, data: { amount: number }) {
  return apiFetch<ApiPosition>(`/api/positions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deletePosition(id: string) {
  return apiFetch<void>(`/api/positions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

// Compensation config
export interface ApiCompensationConfig {
  grossSalary: number
  deductions: { name: string; amount: number }[]
  thirteenthReceived: number
  vacationThirdReceived: number
  bonusYear: number | null
  compoundSavings: boolean
}

export function saveCompensationConfig(config: ApiCompensationConfig) {
  return apiFetch<{ ok: boolean }>('/api/compensation-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

// Pluggy Items
export interface ApiPluggyItem {
  id: string
  user_id: string
  pluggy_item_id: string
  connector_name: string
}

export function createPluggyItem(data: { pluggy_item_id: string; connector_name: string }) {
  return apiFetch<ApiPluggyItem>('/api/pluggy-items', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deletePluggyItem(pluggyItemId: string) {
  return apiFetch<void>(`/api/pluggy-items/${encodeURIComponent(pluggyItemId)}`, {
    method: 'DELETE',
  })
}

// BFF
export interface BootstrapResponse {
  user: { id: string; email: string }
  items: { id: string; name: string }[]
  manual_positions: {
    id: string
    investment_type: string
    subtype: string | null
    amount: number
    due_date: string | null
  }[]
  has_compensation_config: boolean
}

export function getBootstrap() {
  return apiFetch<BootstrapResponse>('/api/bff/bootstrap')
}

export interface BffPosition {
  id: string
  name: string
  investment_type: string
  type_label: string
  type_color: string
  subtype: string | null
  subtype_label: string | null
  amount: number
  currency_code: string
  date: string | null
  due_date: string | null
  rate: number | null
  rate_type: string | null
  fixed_annual_rate: number | null
  rate_display: string
  is_manual: boolean
}

export interface BffSubtypeEntry {
  subtype_key: string
  label: string
  amount: number
  percentage: number
}

export interface BffAllocationEntry {
  type_key: string
  label: string
  amount: number
  percentage: number
  color: string
  subtypes: BffSubtypeEntry[]
}

export interface BffMaturityGroup {
  label: string
  total: number
  count: number
  percentage: number
}

export interface BffInvestmentKpis {
  total_portfolio: number
  fixed_income: number
  fixed_income_pct: number
  variable_income: number
  variable_income_pct: number
  manual_total: number
  manual_count: number
  position_count: number
}

export interface BffInvestmentsResponse {
  positions: BffPosition[]
  kpis: BffInvestmentKpis
  allocation: BffAllocationEntry[]
  maturity_groups: BffMaturityGroup[]
  errors: { positions: string | null }
}

export function getInvestments() {
  return apiFetch<BffInvestmentsResponse>('/api/bff/investments')
}

// BFF Credit Cards
export interface BffSpendingTrendPoint {
  label: string
  total: number
}

export interface BffSpendingTrend {
  data_points: BffSpendingTrendPoint[]
  current_total: number
  previous_total: number
  change_percentage: number | null
}

export interface BffSpendingHistoryDataPoint {
  label: string
  values: Record<string, number>
}

export interface BffSpendingHistory {
  categories: string[]
  data_points: BffSpendingHistoryDataPoint[]
  category_totals: Record<string, number>
}

export interface BffCreditCardsResponse {
  credit_cards: import('@/types').CreditCardAccount[]
  billing_cycles: import('@/types').BillingCycle[]
  spending_history: BffSpendingHistory | null
  spending_trend: BffSpendingTrend | null
  errors: { credit_cards: string | null; billing_cycles: string | null }
}

export function getCreditCards() {
  return apiFetch<BffCreditCardsResponse>('/api/bff/credit-cards')
}

// BFF Dashboard
export interface BffCompositionSegment {
  type_key: string
  label: string
  amount: number
  percentage: number
  color: string
}

export interface BffAttentionItem {
  id: string
  label: string
  amount: number
  urgency: 'red' | 'amber'
  detail: string
}

export interface BffDashboardResponse {
  net_worth: {
    total: number
    accounts_balance: number
    investments_total: number
    currency_code: string
  }
  accounts: { total_balance: number; account_count: number; currency_code: string } | null
  investments: { total_gross_amount: number; investment_count: number; currency_code: string } | null
  composition: { total: number; segments: BffCompositionSegment[] } | null
  allocation: { entries: BffAllocationEntry[]; total: number } | null
  attention_items: BffAttentionItem[]
  spending_trend: BffSpendingTrend | null
  errors: {
    accounts: string | null
    investments: string | null
    credit_cards: string | null
    billing_cycles: string | null
  }
}

export function getDashboard() {
  return apiFetch<BffDashboardResponse>('/api/bff/dashboard')
}

// BFF Projections
export interface BffProjectionsConfigResponse {
  rates: { cdi_annual: number; ipca_annual: number } | null
  expenses: { average_monthly_expenses: number; months_analyzed: number } | null
  compensation: {
    gross_salary: number
    deductions: { name: string; amount: number }[]
    thirteenth_received: number
    vacation_third_received: number
    compound_savings: boolean
  } | null
}

export interface BffMonthlyIncome {
  gross_before_tax: number
  inss: number
  irrf: number
  other_deductions: number
  net_income: number
}

export interface BffAnnualBonuses {
  thirteenth_gross: number
  thirteenth_net: number
  vacation_third_gross: number
  vacation_third_net: number
  total_net: number
}

export interface BffProjectionDataPoint {
  month: string
  label: string
  total: number
  savings: number
  investments: number
  compound_interest: number
}

export interface BffIncomeScheduleRow {
  month: string
  month_idx: number
  gross: number
  inss: number
  irrf: number
  other_deductions: number
  net: number
  note: string
}

export interface BffProjectionsComputeResponse {
  monthly_income: BffMonthlyIncome | null
  annual_bonuses: BffAnnualBonuses | null
  projection: BffProjectionDataPoint[]
  summary: {
    current_total: number
    end_of_year_total: number
    end_of_year_label: string
    growth_percentage: number
    monthly_surplus: number
  }
  income_schedule: BffIncomeScheduleRow[]
}

export function getProjectionsConfig() {
  return apiFetch<BffProjectionsConfigResponse>('/api/bff/projections/config')
}

export function computeProjections(params: {
  cdi_annual: number
  ipca_annual: number
  gross_salary: number
  other_deductions: number
  avg_monthly_expenses: number
  thirteenth_received: number
  vacation_third_received: number
  compound_savings: boolean
}) {
  return apiFetch<BffProjectionsComputeResponse>('/api/bff/projections', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}
