import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from './test/msw-server'
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
