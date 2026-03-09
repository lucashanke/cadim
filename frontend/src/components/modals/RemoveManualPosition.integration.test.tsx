import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

function seedManualPosition() {
  const pos = {
    id: 'manual_remove_test',
    investment_type: 'FIXED_INCOME',
    subtype: 'CDB',
    amount: 750,
    due_date: null,
  }
  document.cookie = `manual_investment_positions=${encodeURIComponent(JSON.stringify([pos]))}; path=/`
}

describe('RemoveManualPosition integration', () => {
  it('removes the position from the table after clicking delete', async () => {
    const user = userEvent.setup()
    seedManualPosition()
    render(<App />)

    await waitFor(() => screen.getByRole('button', { name: /investments/i }))
    await user.click(screen.getByRole('button', { name: /investments/i }))
    await waitFor(() => screen.getByText('Portfolio'))

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

  it('updates the cookie after removing the position', async () => {
    const user = userEvent.setup()
    seedManualPosition()
    render(<App />)

    await waitFor(() => screen.getByRole('button', { name: /investments/i }))
    await user.click(screen.getByRole('button', { name: /investments/i }))
    await waitFor(() => screen.getByText('Portfolio'))
    await waitFor(() => screen.getByText('Manual'))

    const rows = screen.getAllByRole('row')
    const manualRow = rows.find(row => within(row).queryByText('Manual'))!
    const actionButtons = within(manualRow).getAllByRole('button')
    await user.click(actionButtons[1])

    await waitFor(() => {
      expect(screen.queryByText('Manual')).toBeNull()
    })

    // Cookie should be updated (empty array or no matching position)
    const match = document.cookie.match(/manual_investment_positions=([^;]*)/)
    if (match) {
      const positions = JSON.parse(decodeURIComponent(match[1]))
      expect(positions).toHaveLength(0)
    }
  })
})
