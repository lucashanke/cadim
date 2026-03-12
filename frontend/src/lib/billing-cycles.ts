import type { TransactionItem } from '@/types'

export interface BillingCycle {
  key: string
  label: string
  transactions: TransactionItem[]
  total: number
  currency_code: string
}

export function getCycleKey(dateStr: string): string {
  const [yearStr, monthStr] = dateStr.split('T')[0].split('-')
  return `${yearStr}-${monthStr}`
}

export function groupByCycle(transactions: TransactionItem[]): BillingCycle[] {
  const map = new Map<string, TransactionItem[]>()

  for (const txn of transactions) {
    const key = getCycleKey(txn.date)
    const existing = map.get(key)
    if (existing) {
      existing.push(txn)
    } else {
      map.set(key, [txn])
    }
  }

  const cycles: BillingCycle[] = []

  for (const [key, txns] of map) {
    if (key === '2025-03') {
      txns.forEach(t => console.log(t.description, '|', t.category, '|', t.amount_in_account_currency ?? t.amount))
    }
    const total = txns.reduce((acc, txn) =>
      txn.category === 'Credit card payment' || txn.category === 'Transfers' ? acc
        : acc + (txn.amount_in_account_currency != null ? Math.sign(txn.amount) * txn.amount_in_account_currency : txn.amount), 0)

    const currency_code = 'BRL'

    const [yearStr, monthStr] = key.split('-')
    const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1)
    const label = `${date.toLocaleDateString('pt-BR', { month: 'short' })} ${yearStr}`

    const sortedTxns = [...txns].sort((a, b) => b.date.localeCompare(a.date))

    cycles.push({ key, label, transactions: sortedTxns, total, currency_code })
  }

  cycles.sort((a, b) => a.key.localeCompare(b.key))

  return cycles
}
