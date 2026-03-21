import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/msw-server'
import { renderWithRouter } from '../../test/render'
import App from '../../App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

const emptyBffInvestments = {
  positions: [],
  kpis: {
    total_portfolio: 0, fixed_income: 0, fixed_income_pct: 0,
    variable_income: 0, variable_income_pct: 0,
    manual_total: 0, manual_count: 0, position_count: 0,
  },
  allocation: [],
  maturity_groups: [],
  errors: { positions: null },
}

function bffInvestmentsWithManual(amount: number) {
  return {
    positions: [{
      id: 'new-pos-id',
      name: 'Fixed Income',
      investment_type: 'FIXED_INCOME',
      type_label: 'Fixed Income',
      type_color: '#e09020',
      subtype: null,
      subtype_label: null,
      amount,
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
      total_portfolio: amount, fixed_income: amount, fixed_income_pct: 100,
      variable_income: 0, variable_income_pct: 0,
      manual_total: amount, manual_count: 1, position_count: 1,
    },
    allocation: [{
      type_key: 'FIXED_INCOME', label: 'Fixed Income', amount, percentage: 100, color: '#e09020',
      subtypes: [],
    }],
    maturity_groups: [{ label: 'No due date', total: amount, count: 1, percentage: 100 }],
    errors: { positions: null },
  }
}

async function openAddModal() {
  const user = userEvent.setup()
  renderWithRouter(<App />)

  // Navigate to investments page
  await waitFor(() => screen.getByRole('link', { name: /^investments$/i }))
  await user.click(screen.getByRole('link', { name: /^investments$/i }))

  // Wait for investments page to be shown (Add Position button appears in both states)
  await waitFor(() => screen.getByRole('button', { name: /add position/i }))

  // Click Add Position — in empty state there's one button, in non-empty there may be multiple
  const addButtons = screen.getAllByRole('button', { name: /add position/i })
  await user.click(addButtons[0])

  // Wait for modal to open
  await waitFor(() => screen.getByText('Manually add an investment position'))

  return user
}

describe('AddManualPosition integration', () => {
  it('opens the modal when clicking Add Position', async () => {
    await openAddModal()
    expect(screen.getByText('Manually add an investment position')).toBeInTheDocument()
  })

  it('Save button is disabled when amount is empty', async () => {
    await openAddModal()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('adds a new position to the table after saving', async () => {
    // After saving, the refetch should return the new position
    let callCount = 0
    server.use(
      http.get('/api/bff/investments', () => {
        callCount++
        if (callCount <= 1) {
          return HttpResponse.json(emptyBffInvestments)
        }
        return HttpResponse.json(bffInvestmentsWithManual(1500))
      })
    )

    const user = await openAddModal()

    // Fill in amount
    const amountInput = screen.getByPlaceholderText('0.00')
    await user.clear(amountInput)
    await user.type(amountInput, '1500')

    await user.click(screen.getByRole('button', { name: /save/i }))

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText('Manually add an investment position')).toBeNull()
    })

    // The manual badge should now be visible
    await waitFor(() => {
      expect(screen.getByText('Manual')).toBeInTheDocument()
    })
  })

  it('Cancel button closes the modal without saving', async () => {
    const user = await openAddModal()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText('Manually add an investment position')).toBeNull()
    })
    expect(screen.queryByText('Manual')).toBeNull()
  })

  it('clicking backdrop closes the modal without saving', async () => {
    const user = await openAddModal()

    // Click the backdrop overlay
    const backdrop = document.querySelector('.fixed.inset-0.z-50')!
    await user.click(backdrop)

    await waitFor(() => {
      expect(screen.queryByText('Manually add an investment position')).toBeNull()
    })
  })

  it('position persists via API after saving', async () => {
    let callCount = 0
    server.use(
      http.get('/api/bff/investments', () => {
        callCount++
        if (callCount <= 1) {
          return HttpResponse.json(emptyBffInvestments)
        }
        return HttpResponse.json(bffInvestmentsWithManual(2000))
      })
    )

    const user = await openAddModal()

    const amountInput = screen.getByPlaceholderText('0.00')
    await user.clear(amountInput)
    await user.type(amountInput, '2000')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.queryByText('Manually add an investment position')).toBeNull()
    })

    // Position should now appear in the investments table
    await waitFor(() => {
      expect(screen.getByText('Manual')).toBeInTheDocument()
    })
  })
})
