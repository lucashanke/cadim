import { projectPosition, projectNetWorth } from './projections'
import { calculateMonthlyIncome, calculateAnnualBonuses } from './clt-taxes'
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
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(11000)
  })

  it('projects CDI position with partial rate', () => {
    const pos = makePosition({
      rate: 80,
      rate_type: 'CDI',
      fixed_annual_rate: 1.0,
    })
    const result = projectPosition(pos, futureDate(6), 13.25, 5.0)
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
    expect(result).toBeGreaterThan(10000)
    expect(result).toBeLessThan(11000)
  })
})

describe('projectNetWorth', () => {
  it('returns 13 data points (current month + 12)', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,
      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      ...defaultSalaryParams,
    })

    expect(points).toHaveLength(13)
    expect(points[0].total).toBeGreaterThan(9000)
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

    expect(points[0].total).toBeCloseTo(100000, -1)
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
      compoundSavings: true,
    })

    if (points.length > 2) {
      expect(points[1].total).toBeGreaterThan(points[0].total)
      expect(points[2].total).toBeGreaterThan(points[1].total)
    }
  })

  it('cumulative compounding: compound interest grows over time when enabled', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,
      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 10000,
      avgMonthlyExpenses: 3000,
      compoundSavings: true,
    })

    if (points.length > 2) {
      expect(points[2].compoundInterest).toBeGreaterThan(points[1].compoundInterest)
    }
  })

  it('compoundSavings off: no CDI on savings balance', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,
      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 0,
      avgMonthlyExpenses: 0,
      compoundSavings: false,
    })

    // No CDI on savings → all months should have same total (no growth)
    expect(points[0].total).toBe(10000)
    if (points.length > 1) {
      expect(points[1].total).toBe(10000)
      expect(points[1].compoundInterest).toBe(0)
    }
  })

  it('compoundSavings on: CDI grows savings balance', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,
      cdiAnnual: 13.25,
      ipcaAnnual: 5.0,
      grossSalary: 0,
      avgMonthlyExpenses: 0,
      compoundSavings: true,
    })

    expect(points[0].savings).toBe(10000)
    expect(points[0].compoundInterest).toBe(0)
    if (points.length > 1) {
      expect(points[1].savings).toBe(10000)
      expect(points[1].compoundInterest).toBeGreaterThan(0)
      expect(points[1].total).toBeGreaterThan(points[0].total)
    }
  })

  it('expenses are deducted even without salary', () => {
    const points = projectNetWorth({
      positions: [],
      accountsBalance: 10000,
      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: 0,
      avgMonthlyExpenses: 1000,
    })

    if (points.length > 1) {
      // Future months should decrease by expenses
      expect(points[1].total).toBeLessThan(points[0].total)
    }
  })

  it('current month uses partial income based on day-of-month', () => {
    const now = new Date()
    const today = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,
      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: 10000,
      avgMonthlyExpenses: 0,
    })

    const income = calculateMonthlyIncome(10000)
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

    expect(points[0].savings).toBeCloseTo(expectedPending, 0)
  })

  it('December has higher income from bonuses', () => {
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
      expect(decSurplus).toBeGreaterThan(octSurplus)
    }
  })

  it('December includes bonuses minus received amounts', () => {
    const now = new Date()
    if (now.getMonth() > 10) return

    const gross = 10000

    const pointsFull = projectNetWorth({
      positions: [],
      accountsBalance: 0,
      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: gross,
      avgMonthlyExpenses: 0,
      thirteenthReceived: 0,
      vacationThirdReceived: 0,
    })

    const received13 = 3000
    const receivedVac = 1000
    const pointsPartial = projectNetWorth({
      positions: [],
      accountsBalance: 0,
      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: gross,
      avgMonthlyExpenses: 0,
      thirteenthReceived: received13,
      vacationThirdReceived: receivedVac,
    })

    const decIdx = 11 - now.getMonth()
    if (decIdx > 0 && decIdx < pointsFull.length) {
      const fullDecSavings = pointsFull[decIdx].savings
      const partialDecSavings = pointsPartial[decIdx].savings
      expect(fullDecSavings - partialDecSavings).toBeCloseTo(received13 + receivedVac, 0)
    }
  })

  it('fully received bonuses: December equals a regular month', () => {
    const now = new Date()
    if (now.getMonth() > 10) return

    const gross = 10000
    const bonuses = calculateAnnualBonuses(gross)

    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,
      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: gross,
      avgMonthlyExpenses: 0,
      thirteenthReceived: bonuses.thirteenthNet,
      vacationThirdReceived: bonuses.vacationThirdNet,
    })

    const octIdx = 9 - now.getMonth()
    const decIdx = 11 - now.getMonth()
    if (octIdx > 0 && decIdx < points.length) {
      const octSurplus = points[octIdx].savings - points[octIdx - 1].savings
      const decSurplus = points[decIdx].savings - points[decIdx - 1].savings
      expect(decSurplus).toBeCloseTo(octSurplus, 0)
    }
  })

  it('bonuses are not double-counted when projection spans two Decembers', () => {
    // This test is relevant when run in December (startMonth === 11)
    // The loop would hit Dec at i=0 and Dec at i=12
    const now = new Date()
    if (now.getMonth() !== 11) return

    const gross = 10000
    const bonuses = calculateAnnualBonuses(gross)

    const points = projectNetWorth({
      positions: [],
      accountsBalance: 0,
      cdiAnnual: 0,
      ipcaAnnual: 0,
      grossSalary: gross,
      avgMonthlyExpenses: 0,
      thirteenthReceived: 0,
      vacationThirdReceived: 0,
    })

    // i=12 is next year's December — should NOT include bonuses again
    // Regular month income only
    const income = calculateMonthlyIncome(gross)
    const nextDecSurplus = points[12].savings - points[11].savings
    expect(nextDecSurplus).toBeCloseTo(income.netIncome, 0)
  })
})
