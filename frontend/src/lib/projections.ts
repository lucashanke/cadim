import type { InvestmentPosition } from '@/types'
import { calculateMonthlyIncome, calculateAnnualBonuses } from './clt-taxes'

export interface ProjectionDataPoint {
  month: string // "2026-04"
  label: string // "Apr 2026"
  total: number
  savings: number
  investments: number
  compoundInterest: number
}

export interface ProjectionParams {
  positions: InvestmentPosition[]
  accountsBalance: number
  cdiAnnual: number
  ipcaAnnual: number
  grossSalary: number        // 0 = salary disabled (backward compat)
  avgMonthlyExpenses: number  // 0 = no expenses
  otherDeductions?: number   // total monthly deductions beyond INSS/IRRF
  thirteenthReceived?: number  // net amount already received this year
  vacationThirdReceived?: number // net amount already received this year
  compoundSavings?: boolean  // whether bank balance earns CDI (default false)
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
  const { positions, accountsBalance, cdiAnnual, ipcaAnnual, grossSalary, avgMonthlyExpenses, otherDeductions = 0, thirteenthReceived = 0, vacationThirdReceived = 0, compoundSavings = false } = params

  const now = new Date()
  const startMonth = now.getMonth()
  const startYear = now.getFullYear()
  const points: ProjectionDataPoint[] = []
  const cdiMonthly = compoundSavings ? annualToMonthly(cdiAnnual) : 0

  let savings = accountsBalance
  let savingsBase = accountsBalance // tracks savings without CDI compounding

  const baseInvestments = positions.reduce((sum, pos) => sum + pos.amount, 0)

  // Compute remaining bonuses for current-year December only
  let thirteenthRemaining = 0
  let vacationThirdRemaining = 0
  if (grossSalary > 0) {
    const bonuses = calculateAnnualBonuses(grossSalary)
    thirteenthRemaining = Math.max(0, bonuses.thirteenthNet - thirteenthReceived)
    vacationThirdRemaining = Math.max(0, bonuses.vacationThirdNet - vacationThirdReceived)
  }

  // Current month + next 12 months
  for (let i = 0; i <= 12; i++) {
    const year = startYear + Math.floor((startMonth + i) / 12)
    const m = (startMonth + i) % 12
    const monthDate = new Date(year, m, 15)
    const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`
    const label = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    const isCurrentMonth = i === 0
    const isCurrentYearDecember = m === 11 && year === startYear

    if (isCurrentMonth) {
      // Current month: balance already reflects partial income/expenses
      const today = now.getDate()
      const daysInMonth = new Date(year, m + 1, 0).getDate()

      let pendingIncome = 0
      if (grossSalary > 0) {
        const income = calculateMonthlyIncome(grossSalary, otherDeductions)
        const advance = grossSalary * 0.5
        const remainder = income.netIncome - advance

        if (today < 15) {
          pendingIncome = income.netIncome // neither payment received
        } else if (today < daysInMonth) {
          pendingIncome = remainder // advance already in balance
        }

        // Add December bonuses only for current year
        if (isCurrentYearDecember) {
          pendingIncome += thirteenthRemaining + vacationThirdRemaining
        }
      }

      const daysLeft = daysInMonth - today
      const remainingExpenses = avgMonthlyExpenses * (daysLeft / daysInMonth)

      const contribution = pendingIncome - remainingExpenses
      savings += contribution
      savingsBase += contribution
    } else {
      // Future months
      let contribution = -avgMonthlyExpenses
      if (grossSalary > 0) {
        const income = calculateMonthlyIncome(grossSalary, otherDeductions)
        contribution += income.netIncome
        // Add December bonuses only for current year
        if (isCurrentYearDecember) {
          contribution += thirteenthRemaining + vacationThirdRemaining
        }
      }
      savings += contribution
      savingsBase += contribution
      if (compoundSavings) {
        savings *= (1 + cdiMonthly)
      }
    }

    let investmentsTotal = 0
    for (const pos of positions) {
      if (isCurrentMonth) {
        investmentsTotal += pos.amount
      } else {
        investmentsTotal += projectPosition(pos, monthDate, cdiAnnual, ipcaAnnual)
      }
    }

    const compoundInterest = (savings - savingsBase) + (investmentsTotal - baseInvestments)
    const total = savings + investmentsTotal

    points.push({ month: monthKey, label, total, savings: savingsBase, investments: baseInvestments, compoundInterest })
  }

  return points
}
