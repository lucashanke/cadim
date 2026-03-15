import type { InvestmentPosition } from '@/types'
import { calculateMonthlyIncome } from './clt-taxes'

export interface ProjectionDataPoint {
  month: string // "2026-04"
  label: string // "Apr 2026"
  total: number
  savings: number
  investments: number
}

export interface ProjectionParams {
  positions: InvestmentPosition[]
  accountsBalance: number
  cdiAnnual: number
  ipcaAnnual: number
  grossSalary: number        // 0 = salary disabled (backward compat)
  avgMonthlyExpenses: number  // 0 = no expenses
}

const FLAT_TYPES = new Set([
  'EQUITY',
  'MUTUAL_FUND',
  'ETF',
  'COE',
  'OTHER',
])

function annualToMonthly(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1
}

export function projectPosition(
  position: InvestmentPosition,
  monthDate: Date,
  cdiAnnual: number,
  ipcaAnnual: number,
): number {
  const { amount, investment_type, rate, rate_type, fixed_annual_rate, due_date } = position

  // Flat types don't grow
  if (FLAT_TYPES.has(investment_type)) return amount

  // Past maturity or no rate info → assume 100% CDI
  const pastMaturity = due_date && monthDate > new Date(due_date)
  const noRateInfo = !rate_type && !fixed_annual_rate

  let effectiveAnnual: number

  if (pastMaturity || noRateInfo) {
    effectiveAnnual = cdiAnnual
  } else if (rate_type === 'CDI') {
    // CDI% of CDI rate + fixed spread
    const cdiPortion = cdiAnnual * ((rate ?? 100) / 100)
    effectiveAnnual = cdiPortion + (fixed_annual_rate ?? 0)
  } else if (rate_type === 'IPCA') {
    effectiveAnnual = ipcaAnnual + (fixed_annual_rate ?? 0)
  } else {
    // PREFIXADO or fixed-only
    effectiveAnnual = fixed_annual_rate ?? 0
  }

  if (effectiveAnnual === 0) return amount

  const now = new Date()
  const monthsAhead =
    (monthDate.getFullYear() - now.getFullYear()) * 12 +
    (monthDate.getMonth() - now.getMonth())

  if (monthsAhead <= 0) return amount

  const monthlyRate = annualToMonthly(effectiveAnnual)
  return amount * Math.pow(1 + monthlyRate, monthsAhead)
}

export function projectNetWorth(params: ProjectionParams): ProjectionDataPoint[] {
  const { positions, accountsBalance, cdiAnnual, ipcaAnnual, grossSalary, avgMonthlyExpenses } = params

  const now = new Date()
  const endYear = now.getFullYear()
  const points: ProjectionDataPoint[] = []
  const cdiMonthly = annualToMonthly(cdiAnnual)

  let savings = accountsBalance

  // Current month through December of current year
  for (let m = now.getMonth(); m <= 11; m++) {
    const monthDate = new Date(endYear, m, 15)
    const monthKey = `${endYear}-${String(m + 1).padStart(2, '0')}`
    const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    if (m > now.getMonth()) {
      if (grossSalary > 0) {
        const income = calculateMonthlyIncome(grossSalary, m)
        savings += income.netIncome - avgMonthlyExpenses
      }
      savings *= (1 + cdiMonthly)
    }

    let investmentsTotal = 0
    for (const pos of positions) {
      investmentsTotal += projectPosition(pos, monthDate, cdiAnnual, ipcaAnnual)
    }

    const total = savings + investmentsTotal

    points.push({ month: monthKey, label, total, savings, investments: investmentsTotal })
  }

  return points
}
