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

function seedManualPosition() {
  server.use(
    http.get('/api/positions', () =>
      HttpResponse.json([{
        id: 'manual_remove_test',
        user_id: 'test-user-id',
        investment_type: 'FIXED_INCOME',
        subtype: 'CDB',
        amount: 750,
        due_date: null,
      }])
    )
  )
}

describe('RemoveManualPosition integration', () => {
  it('removes the position from the table after clicking delete', async () => {
    const user = userEvent.setup()
    seedManualPosition()
    renderWithRouter(<App />)

    await waitFor(() => screen.getByRole('link', { name: /investments/i }))
    await user.click(screen.getByRole('link', { name: /investments/i }))
    await waitFor(() => screen.getByRole('button', { name: /add position/i }))

    await waitFor(() => screen.getByText('Manual'))

    const rows = screen.getAllByRole('row')
    const manualRow = rows.find(row => within(row).queryByText('Manual'))!

    // The second button (after edit) is the delete button
    const actionButtons = within(manualRow).getAllByRole('button')
    await user.click(actionButtons[1])

    await waitFor(() => {
      expect(screen.queryByText('Manual')).toBeNull()
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
    await waitFor(() => screen.getByRole('button', { name: /add position/i }))
    await waitFor(() => screen.getByText('Manual'))

    const rows = screen.getAllByRole('row')
    const manualRow = rows.find(row => within(row).queryByText('Manual'))!
    const actionButtons = within(manualRow).getAllByRole('button')
    await user.click(actionButtons[1])

    await waitFor(() => {
      expect(screen.queryByText('Manual')).toBeNull()
    })

    expect(deletedId).toBe('manual_remove_test')
  })
})
