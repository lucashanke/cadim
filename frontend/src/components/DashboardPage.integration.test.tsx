import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw-server'
import { ITEM_ID } from '../test/msw-handlers'
import { renderWithRouter } from '../test/render'
import App from '../App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

function seedItem() {
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

function seedDashboard(overrides: Record<string, unknown> = {}) {
  server.use(
    http.get('/api/bff/dashboard', () =>
      HttpResponse.json({
        net_worth: { total: 7500, accounts_balance: 2500, investments_total: 5000, currency_code: 'BRL' },
        accounts: { total_balance: 2500, account_count: 2, currency_code: 'BRL' },
        investments: { total_gross_amount: 5000, investment_count: 3, currency_code: 'BRL' },
        composition: null,
        allocation: null,
        attention_items: [],
        spending_trend: null,
        errors: { accounts: null, investments: null, credit_cards: null, billing_cycles: null },
        ...overrides,
      })
    )
  )
}

describe('DashboardPage integration', () => {
  it('renders formatted account and investment values after loading', async () => {
    seedItem()
    seedDashboard()
    renderWithRouter(<App />)

    // R$ 2.500,00 for accounts, R$ 5.000,00 for investments
    await waitFor(() => {
      expect(screen.getAllByText(/2\.500/).length).toBeGreaterThan(0)
    })
    await waitFor(() => {
      expect(screen.getAllByText(/5\.000/).length).toBeGreaterThan(0)
    })
  })

  it('shows accounts sync error alert with Retry Sync button', async () => {
    seedItem()
    seedDashboard({
      errors: { accounts: 'Pluggy error', investments: null, credit_cards: null, billing_cycles: null },
    })

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByText('Sync Error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry sync/i })).toBeInTheDocument()
    })
  })

  it('clicking Retry Sync for accounts re-fetches', async () => {
    seedItem()
    let callCount = 0

    server.use(
      http.get('/api/bff/dashboard', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({
            net_worth: { total: 0, accounts_balance: 0, investments_total: 0, currency_code: 'BRL' },
            accounts: null,
            investments: null,
            composition: null,
            allocation: null,
            attention_items: [],
            spending_trend: null,
            errors: { accounts: 'first attempt failed', investments: null, credit_cards: null, billing_cycles: null },
          })
        }
        return HttpResponse.json({
          net_worth: { total: 1000, accounts_balance: 1000, investments_total: 0, currency_code: 'BRL' },
          accounts: { total_balance: 1000, account_count: 1, currency_code: 'BRL' },
          investments: null,
          composition: null,
          allocation: null,
          attention_items: [],
          spending_trend: null,
          errors: { accounts: null, investments: null, credit_cards: null, billing_cycles: null },
        })
      })
    )

    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('button', { name: /retry/i }))
    await user.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows investments sync error alert with Retry Sync button', async () => {
    seedItem()
    seedDashboard({
      errors: { accounts: null, investments: 'Pluggy error', credit_cards: null, billing_cycles: null },
    })

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByText('Investments Sync Error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry sync/i })).toBeInTheDocument()
    })
  })

  it('Connect Bank button triggers POST /api/connect-token', async () => {
    let tokenRequested = false
    server.use(
      http.post('/api/connect-token', () => {
        tokenRequested = true
        return HttpResponse.json({ access_token: 'test-token' })
      })
    )

    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('button', { name: /connect bank/i }))
    await user.click(screen.getByRole('button', { name: /connect bank/i }))

    await waitFor(() => {
      expect(tokenRequested).toBe(true)
    })
  })
})
