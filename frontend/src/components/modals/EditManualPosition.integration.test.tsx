import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/msw-server'
import { renderWithRouter } from '../../test/render'
import App from '../../App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

const seedPosition = {
  id: 'manual_edit_test',
  user_id: 'test-user-id',
  investment_type: 'FIXED_INCOME',
  subtype: 'CDB',
  amount: 1000,
  due_date: null,
}

function seedManualPosition() {
  server.use(
    http.get('/api/bff/bootstrap', () =>
      HttpResponse.json({
        user: { id: 'test-user-id', email: 'test@example.com' },
        items: [],
        manual_positions: [{
          id: seedPosition.id,
          investment_type: seedPosition.investment_type,
          subtype: seedPosition.subtype,
          amount: seedPosition.amount,
          due_date: seedPosition.due_date,
        }],
        has_compensation_config: false,
      })
    ),
    http.get('/api/bff/investments', () =>
      HttpResponse.json({
        positions: [{
          id: seedPosition.id,
          name: 'CDB',
          investment_type: seedPosition.investment_type,
          type_label: 'Fixed Income',
          type_color: '#e09020',
          subtype: seedPosition.subtype,
          subtype_label: 'CDB',
          amount: seedPosition.amount,
          currency_code: 'BRL',
          date: null,
          due_date: seedPosition.due_date,
          rate: null,
          rate_type: null,
          fixed_annual_rate: null,
          rate_display: '—',
          is_manual: true,
        }],
        kpis: {
          total_portfolio: seedPosition.amount,
          fixed_income: seedPosition.amount,
          fixed_income_pct: 100,
          variable_income: 0,
          variable_income_pct: 0,
          manual_total: seedPosition.amount,
          manual_count: 1,
          position_count: 1,
        },
        allocation: [{
          type_key: 'FIXED_INCOME',
          label: 'Fixed Income',
          amount: seedPosition.amount,
          percentage: 100,
          color: '#e09020',
          subtypes: [{ subtype_key: 'CDB', label: 'CDB', amount: seedPosition.amount, percentage: 100 }],
        }],
        maturity_groups: [{ label: 'No due date', total: seedPosition.amount, count: 1, percentage: 100 }],
        errors: { positions: null },
      })
    )
  )
}

async function openEditModal() {
  const user = userEvent.setup()
  seedManualPosition()
  renderWithRouter(<App />)

  // Navigate to investments
  await waitFor(() => screen.getByRole('link', { name: /^investments$/i }))
  await user.click(screen.getByRole('link', { name: /^investments$/i }))

  // Wait for Manual badge to appear (manual position is visible)
  await waitFor(() => screen.getByText('Manual'))

  // Find the manual position row and click its first action button (edit = pencil)
  const rows = screen.getAllByRole('row')
  const manualRow = rows.find(row => within(row).queryByText('Manual'))!
  const actionButtons = within(manualRow).getAllByRole('button')
  await user.click(actionButtons[0]) // first button = edit (pencil icon)

  await waitFor(() => screen.getByText('Edit Position'))

  return user
}

describe('EditManualPosition integration', () => {
  it('opens edit modal pre-filled with current amount', async () => {
    await openEditModal()
    const input = screen.getByRole('spinbutton')
    expect((input as HTMLInputElement).value).toBe('1000')
  })

  it('updates the position amount after clicking Update', async () => {
    let capturedBody: Record<string, unknown> | null = null
    server.use(
      http.put('/api/positions/:id', async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>
        return HttpResponse.json({ ...seedPosition, amount: 2500 })
      })
    )

    const user = await openEditModal()

    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '2500')

    await user.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => {
      expect(screen.queryByText('Edit Position')).toBeNull()
    })

    // API should have been called with the new amount
    expect(capturedBody).toEqual({ amount: 2500 })
  })

  it('Cancel closes the modal without updating', async () => {
    let apiCalled = false
    server.use(
      http.put('/api/positions/:id', () => {
        apiCalled = true
        return HttpResponse.json(seedPosition)
      })
    )

    const user = await openEditModal()

    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '9999')

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText('Edit Position')).toBeNull()
    })

    // API should not have been called
    expect(apiCalled).toBe(false)
  })
})
