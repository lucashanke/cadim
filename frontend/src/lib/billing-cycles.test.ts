import { getCycleKey, groupByCycle } from './billing-cycles'
import type { TransactionItem } from '@/types'

function makeTxn(overrides: Partial<TransactionItem> & Pick<TransactionItem, 'id' | 'date' | 'amount' | 'transaction_type'>): TransactionItem {
  return {
    description: 'Test',
    currency_code: 'BRL',
    amount_in_account_currency: overrides.amount != null ? Math.abs(overrides.amount) : null,
    category: null,
    ...overrides,
  }
}

describe('getCycleKey', () => {
  it('returns YYYY-MM of the transaction date', () => {
    expect(getCycleKey('2026-03-10')).toBe('2026-03')
  })

  it('day 1 stays in same month', () => {
    expect(getCycleKey('2026-03-01')).toBe('2026-03')
  })

  it('day 31 stays in same month', () => {
    expect(getCycleKey('2026-03-31')).toBe('2026-03')
  })

  it('January stays in January', () => {
    expect(getCycleKey('2026-01-03')).toBe('2026-01')
  })

  it('handles ISO datetime strings', () => {
    expect(getCycleKey('2026-03-15T10:30:00Z')).toBe('2026-03')
  })
})

describe('groupByCycle', () => {
  it('empty array returns empty array', () => {
    expect(groupByCycle([])).toEqual([])
  })

  it('two transactions same month → one group with correct total', () => {
    const txns = [
      makeTxn({ id: 'a', date: '2026-03-15', amount: -200, transaction_type: 'DEBIT' }),
      makeTxn({ id: 'b', date: '2026-03-20', amount: 50, transaction_type: 'CREDIT' }),
    ]
    const cycles = groupByCycle(txns)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].key).toBe('2026-03')
    // total = -200 + 50 = -150
    expect(cycles[0].total).toBeCloseTo(-150)
  })

  it('transactions in two months → two groups, oldest first', () => {
    const txns = [
      makeTxn({ id: 'a', date: '2026-02-15', amount: -100, transaction_type: 'DEBIT' }),
      makeTxn({ id: 'b', date: '2026-03-12', amount: -200, transaction_type: 'DEBIT' }),
    ]
    const cycles = groupByCycle(txns)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].key).toBe('2026-02')
    expect(cycles[1].key).toBe('2026-03')
  })

  it('excludes Credit card payment category from total', () => {
    const txns = [
      makeTxn({ id: 'a', date: '2026-03-10', amount: -100, transaction_type: 'DEBIT' }),
      makeTxn({ id: 'b', date: '2026-03-15', amount: 500, transaction_type: 'CREDIT', category: 'Credit card payment' }),
    ]
    const cycles = groupByCycle(txns)
    expect(cycles[0].total).toBeCloseTo(-100)
  })
})
