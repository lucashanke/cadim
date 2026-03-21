export interface MonthlyIncome {
  grossBeforeTax: number
  inss: number
  irrf: number
  otherDeductions: number
  netIncome: number
}

// INSS progressive brackets (2025)
const INSS_BRACKETS = [
  { ceiling: 1518.0, rate: 0.075 },
  { ceiling: 2793.88, rate: 0.09 },
  { ceiling: 4190.83, rate: 0.12 },
  { ceiling: 8157.41, rate: 0.14 },
]

export function calculateINSS(gross: number): number {
  let tax = 0
  let prev = 0

  for (const bracket of INSS_BRACKETS) {
    if (gross <= prev) break
    const taxable = Math.min(gross, bracket.ceiling) - prev
    tax += taxable * bracket.rate
    prev = bracket.ceiling
  }

  return Math.round(tax * 100) / 100
}

// IRRF brackets (2025) — applied on (gross - INSS)
const IRRF_BRACKETS = [
  { ceiling: 2259.2, rate: 0, deduction: 0 },
  { ceiling: 2826.65, rate: 0.075, deduction: 169.44 },
  { ceiling: 3751.05, rate: 0.15, deduction: 381.44 },
  { ceiling: 4664.68, rate: 0.225, deduction: 662.77 },
  { ceiling: Infinity, rate: 0.275, deduction: 896.0 },
]

export function calculateIRRF(taxableBase: number): number {
  for (const bracket of IRRF_BRACKETS) {
    if (taxableBase <= bracket.ceiling) {
      const tax = taxableBase * bracket.rate - bracket.deduction
      return Math.max(0, Math.round(tax * 100) / 100)
    }
  }
  return 0
}

export function calculateNetSalary(gross: number): number {
  const inss = calculateINSS(gross)
  const irrf = calculateIRRF(gross - inss)
  return Math.round((gross - inss - irrf) * 100) / 100
}

/**
 * Calculate monthly income for a CLT worker.
 * @param grossSalary - monthly gross salary
 * @param month - 0-indexed month (0 = January, 11 = December)
 * @param thirteenthFirstMonth - 0-indexed month for 13th 1st installment (default 10 = November)
 * @param otherDeductions - total of other monthly deductions (e.g. union contributions)
 */
export function calculateMonthlyIncome(grossSalary: number, month: number, thirteenthFirstMonth: number = 10, otherDeductions: number = 0): MonthlyIncome {
  // Vacation 1/3 spread evenly across 12 months
  const vacationSpread = grossSalary / 36
  const monthlyGross = grossSalary + vacationSpread

  const inss = calculateINSS(monthlyGross)
  const irrf = calculateIRRF(monthlyGross - inss)
  let netIncome = monthlyGross - inss - irrf - otherDeductions

  // 13th salary 1st installment — untaxed (gross * 0.5)
  if (month === thirteenthFirstMonth) {
    netIncome += grossSalary * 0.5
  }

  // December (month 11): 13th salary 2nd installment — taxed on full 13th
  if (month === 11) {
    const thirteenthINSS = calculateINSS(grossSalary)
    const thirteenthIRRF = calculateIRRF(grossSalary - thirteenthINSS)
    const thirteenthNet = grossSalary - thirteenthINSS - thirteenthIRRF
    // 2nd installment = full net 13th minus already-paid 1st installment (0.5 * gross)
    netIncome += thirteenthNet - grossSalary * 0.5
  }

  return {
    grossBeforeTax: monthlyGross,
    inss: Math.round(inss * 100) / 100,
    irrf: Math.round(irrf * 100) / 100,
    otherDeductions: Math.round(otherDeductions * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
  }
}
