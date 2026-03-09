import { http, HttpResponse } from 'msw'

export const ITEM_ID = 'test-item-id'

export const sampleInvestmentsSummary = {
  total_gross_amount: 5000.0,
  currency_code: 'BRL',
  investment_count: 3,
}

export const sampleAccountsSummary = {
  total_balance: 2500.0,
  currency_code: 'BRL',
  account_count: 2,
}

export const samplePositions = [
  {
    id: 'pos-1',
    name: 'CDB Banco X',
    investment_type: 'FIXED_INCOME',
    subtype: 'CDB',
    amount: 2000.0,
    currency_code: 'BRL',
    date: '2024-01-01',
    due_date: '2025-01-01',
    rate: 100.0,
    rate_type: 'CDI',
    fixed_annual_rate: null,
  },
  {
    id: 'pos-2',
    name: 'Tesouro SELIC',
    investment_type: 'TREASURE',
    subtype: 'TESOURO_SELIC',
    amount: 3000.0,
    currency_code: 'BRL',
    date: '2024-01-01',
    due_date: '2027-03-01',
    rate: null,
    rate_type: null,
    fixed_annual_rate: null,
  },
]

export const handlers = [
  http.get('/api/health', () =>
    HttpResponse.json({ status: 'ok', message: 'cadim backend is running' })
  ),

  http.get('/api/investments/:id/summary', () =>
    HttpResponse.json(sampleInvestmentsSummary)
  ),

  http.get('/api/investments/:id/list', () =>
    HttpResponse.json(samplePositions)
  ),

  http.get('/api/accounts/:id/summary', () =>
    HttpResponse.json(sampleAccountsSummary)
  ),

  http.get('/api/items/:id', () =>
    HttpResponse.json({ id: ITEM_ID, connector_name: 'Nubank' })
  ),

  http.post('/api/connect-token', () =>
    HttpResponse.json({ access_token: 'test-connect-token' })
  ),

  http.delete('/api/items/:id', () => new HttpResponse(null, { status: 204 })),
]
