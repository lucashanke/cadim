import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from './test/msw-server'
import { ITEM_ID, sampleTransactions } from './test/msw-handlers'
import { renderWithRouter } from './test/render'
import App from './App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

function seedPluggyItems() {
  server.use(
    http.get('/api/bff/bootstrap', () =>
      HttpResponse.json({
        user: { id: 'test-user-id', email: 'test@example.com' },
        items: [{ id: ITEM_ID, name: 'Nubank' }],
        manual_positions: [],
        has_compensation_config: false,
      })
    )
  )
}

function seedBffCreditCards() {
  const txns = sampleTransactions.results.map(t => ({
    ...t,
    card_last_four: null,
    resolved_amount: t.amount,
  }))
  server.use(
    http.get('/api/bff/credit-cards', () =>
      HttpResponse.json({
        credit_cards: [{ id: 'card-1', name: 'Nubank', balance: 1500, currency_code: 'BRL', credit_limit: 5000, available_credit_limit: 3500, bill_due_date: null, minimum_payment: null }],
        billing_cycles: [{
          key: '2024-01',
          label: 'jan 2024',
          total: 250.0,
          currency_code: 'BRL',
          transactions: txns,
          categories: [{ name: 'Food', amount: 250.0 }],
        }],
        spending_history: null,
        spending_trend: null,
        errors: { credit_cards: null, billing_cycles: null },
      })
    )
  )
}

describe('App integration', () => {
  it('renders the dashboard page by default', async () => {
    renderWithRouter(<App />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })
  })

  it('shows Dashboard nav link in the sidebar', async () => {
    renderWithRouter(<App />)
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    })
  })

  it('switches to investments page when clicking Investments in sidebar', async () => {
    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /^investments$/i }))
    await user.click(screen.getByRole('link', { name: /^investments$/i }))

    // Empty state shown when no items or positions
    await waitFor(() => {
      expect(screen.getByText(/connect a bank account/i)).toBeInTheDocument()
    })
  })

  it('switches to credit cards page when clicking Credit Cards in sidebar', async () => {
    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /credit cards/i }))
    await user.click(screen.getByRole('link', { name: /credit cards/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /credit cards/i })).toBeInTheDocument()
    })
  })

  it('renders transaction cycle tabs when items are connected', async () => {
    seedPluggyItems()
    seedBffCreditCards()
    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /credit cards/i }))
    await user.click(screen.getByRole('link', { name: /credit cards/i }))

    await waitFor(() => {
      expect(screen.getAllByText(sampleTransactions.results[0].description).length).toBeGreaterThan(0)
    })
  })

  it('renders transactions from MSW mock data on credit cards page', async () => {
    seedPluggyItems()
    seedBffCreditCards()
    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /credit cards/i }))
    await user.click(screen.getByRole('link', { name: /credit cards/i }))

    await waitFor(() => {
      expect(screen.getAllByText(sampleTransactions.results[0].description).length).toBeGreaterThan(0)
      expect(screen.getAllByText(sampleTransactions.results[1].description).length).toBeGreaterThan(0)
    })
  })

  it('renders the dashboard even when no items are connected', async () => {
    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connect bank/i })).toBeInTheDocument()
    })
  })
})
