import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

function seedManualPosition() {
  const pos = {
    id: 'manual_edit_test',
    investment_type: 'FIXED_INCOME',
    subtype: 'CDB',
    amount: 1000,
    due_date: null,
  }
  document.cookie = `manual_investment_positions=${encodeURIComponent(JSON.stringify([pos]))}; path=/`
}

async function openEditModal() {
  const user = userEvent.setup()
  seedManualPosition()
  render(<App />)

  // Navigate to investments
  await waitFor(() => screen.getByRole('button', { name: /^investments$/i }))
  await user.click(screen.getByRole('button', { name: /^investments$/i }))

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
    const user = await openEditModal()

    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '2500')

    await user.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => {
      expect(screen.queryByText('Edit Position')).toBeNull()
    })

    // Cookie should be updated
    const match = document.cookie.match(/manual_investment_positions=([^;]*)/)
    const positions = JSON.parse(decodeURIComponent(match![1]))
    expect(positions[0].amount).toBe(2500)
  })

  it('Cancel closes the modal without updating', async () => {
    const user = await openEditModal()

    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '9999')

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByText('Edit Position')).toBeNull()
    })

    // Cookie should still have original amount
    const match = document.cookie.match(/manual_investment_positions=([^;]*)/)
    const positions = JSON.parse(decodeURIComponent(match![1]))
    expect(positions[0].amount).toBe(1000)
  })
})
