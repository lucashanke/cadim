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

export const sampleCreditCards = [
  {
    id: 'card-1',
    name: 'Nubank Mastercard',
    balance: 1500.0,
    currency_code: 'BRL',
    credit_limit: 5000.0,
    available_credit_limit: 3500.0,
    bill_due_date: '2024-02-10',
    minimum_payment: 150.0,
  },
  {
    id: 'card-2',
    name: 'Itaú Visa',
    balance: 800.0,
    currency_code: 'BRL',
    credit_limit: 3000.0,
    available_credit_limit: 2200.0,
    bill_due_date: '2024-02-15',
    minimum_payment: 80.0,
  },
]

export const sampleTransactions = {
  results: [
    {
      id: 'txn-1',
      description: 'Supermercado Extra',
      amount: 250.0,
      amount_in_account_currency: 250.0,
      currency_code: 'BRL',
      date: '2024-01-15',
      category: 'Food',
      transaction_type: 'DEBIT',
    },
    {
      id: 'txn-2',
      description: 'Pagamento fatura',
      amount: 500.0,
      amount_in_account_currency: 500.0,
      currency_code: 'BRL',
      date: '2024-01-10',
      category: null,
      transaction_type: 'CREDIT',
    },
  ],
  total: 2,
  total_pages: 1,
  page: 1,
}

export const sampleTransactionsMultiCycle = {
  results: [
    {
      id: 'txn-A',
      description: 'Restaurante',
      amount: 300.0,
      amount_in_account_currency: 300.0,
      currency_code: 'BRL',
      date: '2026-02-15',
      category: 'Food',
      transaction_type: 'DEBIT',
    },
    {
      id: 'txn-B',
      description: 'Farmácia',
      amount: 100.0,
      amount_in_account_currency: 100.0,
      currency_code: 'BRL',
      date: '2026-02-05',
      category: 'Health',
      transaction_type: 'DEBIT',
    },
    {
      id: 'txn-C',
      description: 'Cashback',
      amount: 50.0,
      amount_in_account_currency: 50.0,
      currency_code: 'BRL',
      date: '2026-01-20',
      category: null,
      transaction_type: 'CREDIT',
    },
  ],
  total: 3,
  total_pages: 1,
  page: 1,
}

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

  http.get('/api/credit-cards/:id/list', () =>
    HttpResponse.json(sampleCreditCards)
  ),

  http.get('/api/transactions/:id', () =>
    HttpResponse.json(sampleTransactions)
  ),
]
