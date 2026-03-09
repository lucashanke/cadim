import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

vi.mock('react-pluggy-connect', () => ({
  PluggyConnect: () => null,
}))

async function openAddModal() {
  const user = userEvent.setup()
  render(<App />)

  // Navigate to investments page
  await waitFor(() => screen.getByRole('button', { name: /^investments$/i }))
  await user.click(screen.getByRole('button', { name: /^investments$/i }))

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

  it('position persists in cookie after saving', async () => {
    const user = await openAddModal()

    const amountInput = screen.getByPlaceholderText('0.00')
    await user.clear(amountInput)
    await user.type(amountInput, '2000')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.queryByText('Manually add an investment position')).toBeNull()
    })

    // Check cookie
    expect(document.cookie).toContain('manual_investment_positions')
    const match = document.cookie.match(/manual_investment_positions=([^;]*)/)
    const positions = JSON.parse(decodeURIComponent(match![1]))
    expect(positions).toHaveLength(1)
    expect(positions[0].amount).toBe(2000)
  })
})
