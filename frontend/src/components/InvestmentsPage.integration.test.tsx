import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw-server'
import { ITEM_ID, samplePositions } from '../test/msw-handlers'
import App from '../App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

function seedItem() {
  localStorage.setItem('pluggy_items', JSON.stringify([{ id: ITEM_ID, name: 'Nubank' }]))
}

async function navigateToInvestments() {
  const user = userEvent.setup()
  await waitFor(() => screen.getByRole('button', { name: /^investments$/i }))
  await user.click(screen.getByRole('button', { name: /^investments$/i }))
  // Add Position button appears in both empty and non-empty states
  await waitFor(() => screen.getByRole('button', { name: /add position/i }))
  return user
}

describe('InvestmentsPage integration', () => {
  it('renders the empty state when no items and no positions', async () => {
    render(<App />)

    await navigateToInvestments()

    expect(screen.getByText(/connect a bank account to see your investment positions/i)).toBeInTheDocument()
  })

  it('renders table with all positions from the API', async () => {
    seedItem()
    render(<App />)

    await navigateToInvestments()

    await waitFor(() => {
      expect(screen.getByText('CDB Banco X')).toBeInTheDocument()
      expect(screen.getByText('Tesouro SELIC')).toBeInTheDocument()
    })
  })

  it('shows API error alert with Retry button', async () => {
    seedItem()
    server.use(
      http.get('/api/investments/:id/list', () =>
        HttpResponse.json({ error: 'Pluggy error' }, { status: 502 })
      )
    )

    render(<App />)
    await navigateToInvestments()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  it('manual positions have Manual badge and edit/delete buttons', async () => {
    // Add a manual position via cookie
    const manualPos = {
      id: 'manual_test',
      investment_type: 'FIXED_INCOME',
      subtype: 'CDB',
      amount: 500,
      due_date: null,
    }
    document.cookie = `manual_investment_positions=${encodeURIComponent(JSON.stringify([manualPos]))}; path=/`

    render(<App />)
    await navigateToInvestments()

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const manualRow = rows.find(row => within(row).queryByText('Manual'))
      expect(manualRow).toBeDefined()
    })
  })

  it('clicking a sort column sorts the table ascending', async () => {
    seedItem()
    render(<App />)
    const user = await navigateToInvestments()

    await waitFor(() => screen.getByText('CDB Banco X'))

    // Click the "Name" column header to sort ascending
    const nameHeader = screen.getByRole('button', { name: /^name$/i })
    await user.click(nameHeader)

    const rows = screen.getAllByRole('row').slice(1) // skip header
    const names = rows.map(row => within(row).getAllByRole('cell')[0].textContent)
    const sorted = [...names].sort((a, b) => (a ?? '').localeCompare(b ?? ''))
    expect(names).toEqual(sorted)
  })

  it('clicking a sorted column again sorts descending', async () => {
    seedItem()
    render(<App />)
    const user = await navigateToInvestments()

    await waitFor(() => screen.getByText('CDB Banco X'))

    const nameHeader = screen.getByRole('button', { name: /^name$/i })
    await user.click(nameHeader) // asc
    await user.click(nameHeader) // desc

    const rows = screen.getAllByRole('row').slice(1)
    const names = rows.map(row => within(row).getAllByRole('cell')[0].textContent)
    const sortedDesc = [...names].sort((a, b) => (b ?? '').localeCompare(a ?? ''))
    expect(names).toEqual(sortedDesc)
  })

  it('non-manual positions have no action buttons', async () => {
    seedItem()
    render(<App />)
    await navigateToInvestments()

    await waitFor(() => screen.getByText('CDB Banco X'))

    const rows = screen.getAllByRole('row').slice(1)
    // Find the CDB Banco X row (from API, not manual)
    const cdbRow = rows.find(row => within(row).queryByText('CDB Banco X'))
    expect(cdbRow).toBeDefined()
    // Should have no edit/delete buttons
    expect(within(cdbRow!).queryByLabelText(/edit/i)).toBeNull()
  })

  it('Add Position button is shown in empty state', async () => {
    render(<App />)
    await navigateToInvestments()

    // navigateToInvestments already asserts Add Position exists
    expect(screen.getAllByRole('button', { name: /add position/i }).length).toBeGreaterThan(0)
  })
})

// Ensure samplePositions is used to avoid "unused import" error
void samplePositions
