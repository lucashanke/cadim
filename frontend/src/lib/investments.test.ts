import { describe, it, expect } from 'vitest'
import { formatRate } from './investments'

describe('formatRate', () => {
  it('returns dash when all null', () => {
    expect(formatRate({ rate: null, rate_type: null, fixed_annual_rate: null })).toBe('—')
  })

  it('returns rate_type only when rate is null', () => {
    expect(formatRate({ rate: null, rate_type: 'CDI', fixed_annual_rate: null })).toBe('CDI')
  })

  it('returns rate + type when both present', () => {
    expect(formatRate({ rate: 100, rate_type: 'CDI', fixed_annual_rate: null })).toBe('100% CDI')
  })

  it('suppresses rate=100 when fixed_annual_rate is also present', () => {
    expect(formatRate({ rate: 100, rate_type: 'CDI', fixed_annual_rate: 3.5 })).toBe('CDI + 3.5% a.a.')
  })

  it('shows rate + type + fixed_annual_rate when rate is not 100', () => {
    expect(formatRate({ rate: 120, rate_type: 'CDI', fixed_annual_rate: 1.5 })).toBe('120% CDI + 1.5% a.a.')
  })

  it('returns fixed_annual_rate only when rate_type is null', () => {
    expect(formatRate({ rate: null, rate_type: null, fixed_annual_rate: 3.5 })).toBe('3.5% a.a.')
  })

  it('handles zero rate as falsy (treated as null)', () => {
    expect(formatRate({ rate: 0, rate_type: 'CDI', fixed_annual_rate: null })).toBe('CDI')
  })
})
