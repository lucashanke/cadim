import type { InvestmentPosition } from '@/types'

export function formatRate(pos: Pick<InvestmentPosition, 'rate' | 'rate_type' | 'fixed_annual_rate'>): string {
  const rate = pos.rate || null
  const rate_type = pos.rate_type
  const fixed_annual_rate = pos.fixed_annual_rate || null
  if (!rate_type && fixed_annual_rate == null) return '—'
  const parts: string[] = []
  if (rate != null && rate_type && !(rate === 100 && fixed_annual_rate != null)) parts.push(`${rate}%`)
  if (rate_type) parts.push(rate_type)
  if (parts.length > 0 && fixed_annual_rate != null) {
    return parts.join(' ') + ` + ${fixed_annual_rate}% a.a.`
  }
  if (parts.length > 0) return parts.join(' ')
  if (fixed_annual_rate != null) return `${fixed_annual_rate}% a.a.`
  return '—'
}
