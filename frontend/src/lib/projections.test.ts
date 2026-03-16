import { projectPosition, projectNetWorth } from './projections'
import { calculateMonthlyIncome } from './clt-taxes'
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

  it('projects matured positions at 100% CDI', () => {
    const pastDate = new Date()
    pastDate.setMonth(pastDate.getMonth() - 1)
    const pos = makePosition({
      rate_type: 'CDI',
      rate: 100,
      fixed_annual_rate: 0,
      due_date: pastDate.toISOString().split('T')[0],
    })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    // Past maturity → defaults to 100% CDI (13.25% annual)
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(11000)
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

  it('projects positions without rate info at 100% CDI', () => {
    const pos = makePosition({})
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
    // No rate info → defaults to 100% CDI (13.25% annual)
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(11000)
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
    // First point: balance + pending income - remaining expenses + CDI
    expect(points[0].total).toBeGreaterThan(9000)
    // Last point should show CDI growth on savings
    if (points.length > 1) {
      expect(points[points.length - 1].total).toBeGreaterThan(points[0].total)
    }
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

    // No salary, so no partial-month adjustment — just CDI compounding
    expect(points[0].total).toBeGreaterThan(19900)
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

  it('salary with expenses: total grows each month', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 10000,
      avgMonthlyExpenses: 5000,
    })

    if (points.length > 2) {
      // Total should grow over time (net income > expenses + CDI compounding)
      expect(points[1].total).toBeGreaterThan(points[0].total)
      expect(points[2].total).toBeGreaterThan(points[1].total)
    }
  })

  it('cumulative compounding: compound interest grows over time', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 10000,
      avgMonthlyExpenses: 3000,
    })

    if (points.length > 2) {
      // Compound interest should increase as savings base grows
      expect(points[2].compoundInterest).toBeGreaterThan(points[1].compoundInterest)
    }
  })

  it('zero salary: compound interest grows at CDI', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,

      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 0,
      avgMonthlyExpenses: 0,
    })

    // Savings base stays constant, compound interest grows
    expect(points[0].savings).toBe(10000)
    expect(points[0].compoundInterest).toBeGreaterThan(0)
    if (points.length > 1) {
      expect(points[1].savings).toBe(10000)
      expect(points[1].compoundInterest).toBeGreaterThan(points[0].compoundInterest)
      expect(points[1].total).toBeGreaterThan(points[0].total)
    }
  })

  it('current month uses partial income based on day-of-month', () => {
    const now = new Date()
    const today = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    // With salary but zero CDI/expenses to isolate the partial income effect
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,
      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: 10000,
      avgMonthlyExpenses: 0,
    })

    const income = calculateMonthlyIncome(10000, now.getMonth())
    const advance = 10000 * 0.5
    const remainder = income.netIncome - advance

    let expectedPending: number
    if (today < 15) {
      expectedPending = income.netIncome
    } else if (today < daysInMonth) {
      expectedPending = remainder
    } else {
      expectedPending = 0
    }

    // Current month savings should equal pending income (no expenses, no CDI)
    expect(points[0].savings).toBeCloseTo(expectedPending, 0)
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
