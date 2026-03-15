import { projectPosition, projectNetWorth } from './projections'
import type { InvestmentPosition } from '@/types'

function makePosition(overrides: Partial<InvestmentPosition> = {}): InvestmentPosition {
  return {
    id: '1',
    name: 'Test',
    investment_type: 'FIXED_INCOME',
    subtype: null,
    amount: 10000,
    currency_code: 'BRL',
    date: null,
    due_date: null,
    rate: null,
    rate_type: null,
    fixed_annual_rate: null,
    ...overrides,
  }
}

// Use a future date for projections (6 months from a fixed "now")
function futureDate(monthsAhead: number): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + monthsAhead, 15)
}

const defaultSalaryParams = { grossSalary: 0, avgMonthlyExpenses: 0 }

describe('projectPosition', () => {
  it('projects CDI position', () => {
    const pos = makePosition({
      rate: 100,
      rate_type: 'CDI',
      fixed_annual_rate: 0,
    })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    // Should grow: 10000 * (1 + monthlyRate)^6
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(11000) // ~6.3% in 6 months at 13.25%
  })

  it('projects CDI position with partial rate', () => {
    const pos = makePosition({
      rate: 80,
      rate_type: 'CDI',
      fixed_annual_rate: 1.0,
    })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    // 80% of 13.25 = 10.6, + 1.0 = 11.6% annual
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(10700)
  })

  it('projects IPCA position', () => {
    const pos = makePosition({
      rate: null,
      rate_type: 'IPCA',
      fixed_annual_rate: 6.0,
    })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    // effective = 5.0 + 6.0 = 11.0% annual
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(10700)
  })

  it('projects prefixado/fixed-only position', () => {
    const pos = makePosition({
      rate_type: 'PREFIXADO',
      fixed_annual_rate: 12.0,
    })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(10700)
  })

  it('keeps equity positions flat', () => {
    const pos = makePosition({ investment_type: 'EQUITY', amount: 5000 })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    expect(result).toBe(5000)
  })

  it('keeps ETF positions flat', () => {
    const pos = makePosition({ investment_type: 'ETF', amount: 3000 })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    expect(result).toBe(3000)
  })

  it('freezes matured positions', () => {
    const pastDate = new Date()
    pastDate.setMonth(pastDate.getMonth() - 1)
    const pos = makePosition({
      rate_type: 'CDI',
      rate: 100,
      fixed_annual_rate: 0,
      due_date: pastDate.toISOString().split('T')[0],
    })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    expect(result).toBe(10000)
  })

  it('returns amount for current month (0 months ahead)', () => {
    const pos = makePosition({
      rate_type: 'CDI',
      rate: 100,
      fixed_annual_rate: 0,
    })
    const result = projectPosition(pos, new Date(), 13.25, 5.0)
    expect(result).toBe(10000)
  })

  it('returns amount for positions without rate info', () => {
    const pos = makePosition({})
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    expect(result).toBe(10000)
  })
})

describe('projectNetWorth', () => {
  it('returns data points from current month through December', () => {
    const now = new Date()
    const expectedCount = 12 - now.getMonth()

    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      ...defaultSalaryParams,
    })

    expect(points).toHaveLength(expectedCount)
    expect(points[0].total).toBe(10000) // accounts balance only
    expect(points[points.length - 1].total).toBe(10000)
  })

  it('includes investment growth in totals', () => {
    const pos = makePosition({
      rate: 100,
      rate_type: 'CDI',
      fixed_annual_rate: 0,
      amount: 100000,
    })

    const points = projectNetWorth({
      positions: [pos],
      accountsBalance: 0,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      ...defaultSalaryParams,
    })

    // First point should be approximately current amount
    expect(points[0].total).toBeCloseTo(100000, -1)
    // Last point should show growth (if we have months remaining)
    if (points.length > 1) {
      expect(points[points.length - 1].total).toBeGreaterThan(100000)
    }
  })

  it('includes accounts balance in totals', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 20000,
      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      ...defaultSalaryParams,
    })

    expect(points[0].total).toBe(20000)
  })

  it('has proper month labels', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,

      cdiAnnual: 0,
      ipcaAnnual: 0,
      ...defaultSalaryParams,
    })

    expect(points[0].month).toMatch(/^\d{4}-\d{2}$/)
    expect(points[0].label).toMatch(/\w+ \d{4}/)
  })

  it('salary with expenses: savings grow each month', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 10000,
      avgMonthlyExpenses: 5000,
    })

    if (points.length > 2) {
      // Savings should grow over time (net income > expenses)
      expect(points[1].savings).toBeGreaterThan(points[0].savings)
      expect(points[2].savings).toBeGreaterThan(points[1].savings)
    }
  })

  it('cumulative compounding: month 2 builds on month 1', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 10000,
      avgMonthlyExpenses: 3000,
    })

    if (points.length > 2) {
      // Month 2 savings should be more than just one month's surplus
      // because it compounds the previous month's savings
      const surplus1 = points[1].savings - points[0].savings
      const surplus2 = points[2].savings - points[1].savings
      expect(surplus2).toBeGreaterThan(surplus1)
    }
  })

  it('zero salary = backward-compatible flat behavior', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 0,
      avgMonthlyExpenses: 0,
    })

    // All totals should be the same (no growth from salary)
    for (const point of points) {
      expect(point.total).toBe(10000)
    }
  })

  it('November has higher income from 13th 1st installment', () => {
    const now = new Date()
    // Only test if we have November in our projection range
    if (now.getMonth() > 10) return

    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,

      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: 10000,
      avgMonthlyExpenses: 5000,
    })

    // Find October and November points
    const octIdx = 9 - now.getMonth()
    const novIdx = 10 - now.getMonth()
    if (octIdx > 0 && novIdx < points.length) {
      const octSurplus = points[octIdx].savings - points[octIdx - 1].savings
      const novSurplus = points[novIdx].savings - points[novIdx - 1].savings
      // November surplus should be bigger due to 13th salary 1st installment
      expect(novSurplus).toBeGreaterThan(octSurplus)
    }
  })

  it('December has higher income from 13th 2nd installment', () => {
    const now = new Date()
    if (now.getMonth() > 10) return

    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,

      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: 10000,
      avgMonthlyExpenses: 5000,
    })

    const octIdx = 9 - now.getMonth()
    const decIdx = 11 - now.getMonth()
    if (octIdx > 0 && decIdx < points.length) {
      const octSurplus = points[octIdx].savings - points[octIdx - 1].savings
      const decSurplus = points[decIdx].savings - points[decIdx - 1].savings
      // December surplus should be bigger due to 13th salary 2nd installment
      expect(decSurplus).toBeGreaterThan(octSurplus)
    }
  })
})
