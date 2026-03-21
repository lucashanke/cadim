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
    const user = userEvent.setup()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /credit cards/i }))
    await user.click(screen.getByRole('link', { name: /credit cards/i }))

    await waitFor(() => {
      expect(screen.getAllByText(sampleTransactions.results[0].description).length).toBeGreaterThan(0)
      expect(screen.getAllByText(sampleTransactions.results[1].description).length).toBeGreaterThan(0)
    })
  })

  it('surfaces a health API error as an alert on the dashboard', async () => {
    server.use(
      http.get('/api/health', () => HttpResponse.json({ error: 'down' }, { status: 500 }))
    )

    renderWithRouter(<App />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
