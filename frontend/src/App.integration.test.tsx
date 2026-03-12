import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from './test/msw-server'
import { ITEM_ID, sampleCreditCards, sampleTransactions } from './test/msw-handlers'
import { STORAGE_KEY } from './lib/storage'
import App from './App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

describe('App integration', () => {
  it('renders the dashboard page by default', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })
  })

  it('shows Dashboard nav button in the sidebar', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument()
    })
  })

  it('switches to investments page when clicking Investments in sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => screen.getByRole('button', { name: /^investments$/i }))
    await user.click(screen.getByRole('button', { name: /^investments$/i }))

    // Empty state shown when no items or positions
    await waitFor(() => {
      expect(screen.getByText(/connect a bank account/i)).toBeInTheDocument()
    })
  })

  it('switches to credit cards page when clicking Credit Cards in sidebar', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => screen.getByRole('button', { name: /credit cards/i }))
    await user.click(screen.getByRole('button', { name: /credit cards/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /credit cards/i })).toBeInTheDocument()
    })
  })

  it('renders transaction cycle tabs when items are connected', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: ITEM_ID, name: 'Nubank' }]))
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => screen.getByRole('button', { name: /credit cards/i }))
    await user.click(screen.getByRole('button', { name: /credit cards/i }))

    await waitFor(() => {
      expect(screen.getAllByText(sampleTransactions.results[0].description).length).toBeGreaterThan(0)
    })

    localStorage.removeItem(STORAGE_KEY)
  })

  it('renders transactions from MSW mock data on credit cards page', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: ITEM_ID, name: 'Nubank' }]))
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => screen.getByRole('button', { name: /credit cards/i }))
    await user.click(screen.getByRole('button', { name: /credit cards/i }))

    await waitFor(() => {
      expect(screen.getAllByText(sampleTransactions.results[0].description).length).toBeGreaterThan(0)
      expect(screen.getAllByText(sampleTransactions.results[1].description).length).toBeGreaterThan(0)
    })

    localStorage.removeItem(STORAGE_KEY)
  })

  it('surfaces a health API error as an alert on the dashboard', async () => {
    server.use(
      http.get('/api/health', () => HttpResponse.json({ error: 'down' }, { status: 500 }))
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
