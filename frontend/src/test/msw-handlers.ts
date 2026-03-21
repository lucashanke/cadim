import { http, HttpResponse } from 'msw'

export const ITEM_ID = 'test-item-id'

export const sampleBffPositions = [
  {
    id: 'pos-1',
    name: 'CDB Banco X',
    investment_type: 'FIXED_INCOME',
    type_label: 'Fixed Income',
    type_color: '#e09020',
    subtype: 'CDB',
    subtype_label: 'CDB',
    amount: 2000.0,
    currency_code: 'BRL',
    date: '2024-01-01',
    due_date: '2025-01-01',
    rate: 100.0,
    rate_type: 'CDI',
    fixed_annual_rate: null,
    rate_display: '100% CDI',
    is_manual: false,
  },
  {
    id: 'pos-2',
    name: 'Tesouro SELIC',
    investment_type: 'TREASURE',
    type_label: 'Treasury',
    type_color: '#b89820',
    subtype: 'TESOURO_SELIC',
    subtype_label: 'Tesouro Selic',
    amount: 3000.0,
    currency_code: 'BRL',
    date: '2024-01-01',
    due_date: '2027-03-01',
    rate: null,
    rate_type: null,
    fixed_annual_rate: null,
    rate_display: '—',
    is_manual: false,
  },
]

export const sampleBffInvestmentsResponse = {
  positions: sampleBffPositions,
  kpis: {
    total_portfolio: 5000.0,
    fixed_income: 5000.0,
    fixed_income_pct: 100.0,
    variable_income: 0,
    variable_income_pct: 0,
    manual_total: 0,
    manual_count: 0,
    position_count: 2,
  },
  allocation: [
    {
      type_key: 'FIXED_INCOME',
      label: 'Fixed Income',
      amount: 2000.0,
      percentage: 40.0,
      color: '#e09020',
      subtypes: [{ subtype_key: 'CDB', label: 'CDB', amount: 2000.0, percentage: 100.0 }],
    },
    {
      type_key: 'TREASURE',
      label: 'Treasury',
      amount: 3000.0,
      percentage: 60.0,
      color: '#b89820',
      subtypes: [{ subtype_key: 'TESOURO_SELIC', label: 'Tesouro Selic', amount: 3000.0, percentage: 100.0 }],
    },
  ],
  maturity_groups: [
    { label: 'Matured', total: 2000.0, count: 1, percentage: 40.0 },
    { label: '6–12 months', total: 3000.0, count: 1, percentage: 60.0 },
  ],
  errors: { positions: null },
}

export const sampleTransactions = {
  results: [
    {
      id: 'txn-1',
      description: 'Supermercado Extra',
      amount: 250.0,
      amount_in_account_currency: 250.0,
      resolved_amount: 250.0,
      currency_code: 'BRL',
      date: '2024-01-15',
      category: 'Food',
      transaction_type: 'DEBIT',
      card_last_four: null,
    },
    {
      id: 'txn-2',
      description: 'Pagamento fatura',
      amount: 500.0,
      amount_in_account_currency: 500.0,
      resolved_amount: 500.0,
      currency_code: 'BRL',
      date: '2024-01-10',
      category: null,
      transaction_type: 'CREDIT',
      card_last_four: null,
    },
  ],
  total: 2,
  total_pages: 1,
  page: 1,
}

export const handlers = [
  // Auth endpoints
  http.get('/api/auth/me', () =>
    HttpResponse.json({ id: 'test-user-id', email: 'test@example.com' })
  ),

  // BFF bootstrap
  http.get('/api/bff/bootstrap', () =>
    HttpResponse.json({
      user: { id: 'test-user-id', email: 'test@example.com' },
      items: [],
      manual_positions: [],
      has_compensation_config: false,
    })
  ),

  // Data endpoints (used by App.tsx for CRUD and migration)
  http.post('/api/positions', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ id: 'new-pos-id', user_id: 'test-user-id', ...body }, { status: 201 })
  }),

  http.put('/api/positions/:id', async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ id: params.id, user_id: 'test-user-id', investment_type: 'FIXED_INCOME', subtype: null, amount: 0, due_date: null, ...body })
  }),

  http.delete('/api/positions/:id', () =>
    new HttpResponse(null, { status: 204 })
  ),

  http.put('/api/compensation-config', () =>
    HttpResponse.json({ ok: true })
  ),

  http.post('/api/pluggy-items', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ id: 'new-pluggy-item-id', user_id: 'test-user-id', ...body }, { status: 201 })
  }),

  http.delete('/api/pluggy-items/:pluggyItemId', () =>
    new HttpResponse(null, { status: 204 })
  ),

  http.get('/api/items/:id', () =>
    HttpResponse.json({ id: ITEM_ID, connector_name: 'Nubank' })
  ),

  http.post('/api/connect-token', () =>
    HttpResponse.json({ access_token: 'test-connect-token' })
  ),

  http.delete('/api/items/:id', () => new HttpResponse(null, { status: 204 })),

  // BFF investments
  http.get('/api/bff/investments', () =>
    HttpResponse.json({
      positions: [],
      kpis: {
        total_portfolio: 0,
        fixed_income: 0,
        fixed_income_pct: 0,
        variable_income: 0,
        variable_income_pct: 0,
        manual_total: 0,
        manual_count: 0,
        position_count: 0,
      },
      allocation: [],
      maturity_groups: [],
      errors: { positions: null },
    })
  ),

  // BFF credit cards
  http.get('/api/bff/credit-cards', () =>
    HttpResponse.json({
      credit_cards: [],
      billing_cycles: [],
      spending_history: null,
      spending_trend: null,
      errors: { credit_cards: null, billing_cycles: null },
    })
  ),

  // BFF projections
  http.get('/api/bff/projections/config', () =>
    HttpResponse.json({
      rates: null,
      expenses: null,
      compensation: null,
    })
  ),

  http.post('/api/bff/projections', () =>
    HttpResponse.json({
      monthly_income: null,
      annual_bonuses: null,
      projection: [],
      summary: {
        current_total: 0,
        end_of_year_total: 0,
        end_of_year_label: '',
        growth_percentage: 0,
        monthly_surplus: 0,
      },
      income_schedule: [],
    })
  ),

  // BFF dashboard
  http.get('/api/bff/dashboard', () =>
    HttpResponse.json({
      net_worth: { total: 0, accounts_balance: 0, investments_total: 0, currency_code: 'BRL' },
      accounts: null,
      investments: null,
      composition: null,
      allocation: null,
      attention_items: [],
      spending_trend: null,
      errors: { accounts: null, investments: null, credit_cards: null, billing_cycles: null },
    })
  ),
]
