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
    http.get('/api/pluggy-items', () =>
      HttpResponse.json([{
        id: 'internal-id',
        user_id: 'test-user-id',
        pluggy_item_id: ITEM_ID,
        connector_name: 'Nubank',
      }])
    )
  )
}

describe('DashboardPage integration', () => {
  it('renders formatted account and investment values after loading', async () => {
    seedItem()
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
    server.use(
      http.get('/api/accounts/summary', () =>
        HttpResponse.json({ error: 'Pluggy error' }, { status: 502 })
      )
    )

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
      http.get('/api/accounts/summary', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({ error: 'first attempt failed' }, { status: 502 })
        }
        return HttpResponse.json({ total_balance: 1000, currency_code: 'BRL', account_count: 1 })
      })
    )

    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('button', { name: /retry sync/i }))
    await user.click(screen.getByRole('button', { name: /retry sync/i }))

    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows investments sync error alert with Retry Sync button', async () => {
    seedItem()
    server.use(
      http.get('/api/investments/summary', () =>
        HttpResponse.json({ error: 'Pluggy error' }, { status: 502 })
      )
    )

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
