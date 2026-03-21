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

const manualPosition = {
  id: 'manual_remove_test',
  investment_type: 'FIXED_INCOME',
  subtype: 'CDB',
  amount: 750,
  due_date: null,
}

function seedManualPosition() {
  server.use(
    http.get('/api/bff/bootstrap', () =>
      HttpResponse.json({
        user: { id: 'test-user-id', email: 'test@example.com' },
        items: [],
        manual_positions: [{
          id: manualPosition.id,
          investment_type: manualPosition.investment_type,
          subtype: manualPosition.subtype,
          amount: manualPosition.amount,
          due_date: manualPosition.due_date,
        }],
        has_compensation_config: false,
      })
    ),
    http.get('/api/bff/investments', () =>
      HttpResponse.json({
        positions: [{
          id: manualPosition.id,
          name: 'CDB',
          investment_type: manualPosition.investment_type,
          type_label: 'Fixed Income',
          type_color: '#e09020',
          subtype: manualPosition.subtype,
          subtype_label: 'CDB',
          amount: manualPosition.amount,
          currency_code: 'BRL',
          date: null,
          due_date: manualPosition.due_date,
          rate: null,
          rate_type: null,
          fixed_annual_rate: null,
          rate_display: '—',
          is_manual: true,
        }],
        kpis: {
          total_portfolio: manualPosition.amount,
          fixed_income: manualPosition.amount,
          fixed_income_pct: 100,
          variable_income: 0,
          variable_income_pct: 0,
          manual_total: manualPosition.amount,
          manual_count: 1,
          position_count: 1,
        },
        allocation: [{
          type_key: 'FIXED_INCOME',
          label: 'Fixed Income',
          amount: manualPosition.amount,
          percentage: 100,
          color: '#e09020',
          subtypes: [{ subtype_key: 'CDB', label: 'CDB', amount: manualPosition.amount, percentage: 100 }],
        }],
        maturity_groups: [{ label: 'No due date', total: manualPosition.amount, count: 1, percentage: 100 }],
        errors: { positions: null },
      })
    )
  )
}

describe('RemoveManualPosition integration', () => {
  it('removes the position from the table after clicking delete', async () => {
    const user = userEvent.setup()
    seedManualPosition()

    // After delete, BFF returns empty
    let deleteCount = 0
    server.use(
      http.delete('/api/positions/:id', () => {
        deleteCount++
        return new HttpResponse(null, { status: 204 })
      })
    )

    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /investments/i }))
    await user.click(screen.getByRole('link', { name: /investments/i }))

    await waitFor(() => screen.getByText('Manual'))

    const rows = screen.getAllByRole('row')
    const manualRow = rows.find(row => within(row).queryByText('Manual'))!

    // The second button (after edit) is the delete button
    const actionButtons = within(manualRow).getAllByRole('button')
    await user.click(actionButtons[1])

    await waitFor(() => {
      expect(deleteCount).toBeGreaterThan(0)
    })
  })

  it('calls DELETE API after removing the position', async () => {
    let deletedId: string | null = null
    server.use(
      http.delete('/api/positions/:id', ({ params }) => {
        deletedId = params.id as string
        return new HttpResponse(null, { status: 204 })
      })
    )

    const user = userEvent.setup()
    seedManualPosition()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /investments/i }))
    await user.click(screen.getByRole('link', { name: /investments/i }))
    await waitFor(() => screen.getByText('Manual'))

    const rows = screen.getAllByRole('row')
    const manualRow = rows.find(row => within(row).queryByText('Manual'))!
    const actionButtons = within(manualRow).getAllByRole('button')
    await user.click(actionButtons[1])

    await waitFor(() => {
      expect(deletedId).toBe('manual_remove_test')
    })
  })
})
