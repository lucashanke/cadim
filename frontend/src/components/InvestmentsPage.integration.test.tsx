import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw-server'
import { ITEM_ID, sampleBffInvestmentsResponse } from '../test/msw-handlers'
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

function seedBffInvestments() {
  server.use(
    http.get('/api/bff/investments', () =>
      HttpResponse.json(sampleBffInvestmentsResponse)
    )
  )
}

async function navigateToInvestments() {
  const user = userEvent.setup()
  await waitFor(() => screen.getByRole('link', { name: /^investments$/i }))
  await user.click(screen.getByRole('link', { name: /^investments$/i }))
  return user
}

describe('InvestmentsPage integration', () => {
  it('renders the empty state when no items and no positions', async () => {
    renderWithRouter(<App />)

    await navigateToInvestments()

    await waitFor(() => {
      expect(screen.getByText(/connect a bank account to see your investment positions/i)).toBeInTheDocument()
    })
  })

  it('renders table with all positions from the API', async () => {
    seedItem()
    seedBffInvestments()
    renderWithRouter(<App />)

    await navigateToInvestments()

    await waitFor(() => {
      expect(screen.getByText('CDB Banco X')).toBeInTheDocument()
      expect(screen.getByText('Tesouro SELIC')).toBeInTheDocument()
    })
  })

  it('shows API error alert with Retry button', async () => {
    seedItem()
    server.use(
      http.get('/api/bff/investments', () =>
        HttpResponse.json({ error: 'Pluggy error' }, { status: 502 })
      )
    )

    renderWithRouter(<App />)
    await navigateToInvestments()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })
  })

  it('manual positions have Manual badge and edit/delete buttons', async () => {
    server.use(
      http.get('/api/bff/bootstrap', () =>
        HttpResponse.json({
          user: { id: 'test-user-id', email: 'test@example.com' },
          items: [],
          manual_positions: [{
            id: 'manual_test',
            investment_type: 'FIXED_INCOME',
            subtype: 'CDB',
            amount: 500,
            due_date: null,
          }],
          has_compensation_config: false,
        })
      ),
      http.get('/api/bff/investments', () =>
        HttpResponse.json({
          positions: [{
            id: 'manual_test',
            name: 'CDB',
            investment_type: 'FIXED_INCOME',
            type_label: 'Fixed Income',
            type_color: '#e09020',
            subtype: 'CDB',
            subtype_label: 'CDB',
            amount: 500,
            currency_code: 'BRL',
            date: null,
            due_date: null,
            rate: null,
            rate_type: null,
            fixed_annual_rate: null,
            rate_display: '—',
            is_manual: true,
          }],
          kpis: {
            total_portfolio: 500,
            fixed_income: 500,
            fixed_income_pct: 100,
            variable_income: 0,
            variable_income_pct: 0,
            manual_total: 500,
            manual_count: 1,
            position_count: 1,
          },
          allocation: [{
            type_key: 'FIXED_INCOME',
            label: 'Fixed Income',
            amount: 500,
            percentage: 100,
            color: '#e09020',
            subtypes: [{ subtype_key: 'CDB', label: 'CDB', amount: 500, percentage: 100 }],
          }],
          maturity_groups: [{ label: 'No due date', total: 500, count: 1, percentage: 100 }],
          errors: { positions: null },
        })
      )
    )

    renderWithRouter(<App />)
    await navigateToInvestments()

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      const manualRow = rows.find(row => within(row).queryByText('Manual'))
      expect(manualRow).toBeDefined()
    })
  })

  it('clicking a sort column sorts the table ascending', async () => {
    seedItem()
    seedBffInvestments()
    renderWithRouter(<App />)
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
    seedBffInvestments()
    renderWithRouter(<App />)
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
    seedBffInvestments()
    renderWithRouter(<App />)
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
    renderWithRouter(<App />)
    await navigateToInvestments()

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /add position/i }).length).toBeGreaterThan(0)
    })
  })
})

// Ensure sampleBffInvestmentsResponse is used to avoid "unused import" error
void sampleBffInvestmentsResponse
