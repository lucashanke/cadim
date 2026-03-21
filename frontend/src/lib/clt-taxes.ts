export interface MonthlyIncome {
  grossBeforeTax: number
  inss: number
  irrf: number
  otherDeductions: number
  netIncome: number
}

// INSS progressive brackets (2026)
const INSS_BRACKETS = [
  { ceiling: 1621.0, rate: 0.075 },
  { ceiling: 2902.84, rate: 0.09 },
  { ceiling: 4354.27, rate: 0.12 },
  { ceiling: 8475.55, rate: 0.14 },
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

// IRRF brackets (2026) — applied on (gross - INSS)
const IRRF_BRACKETS = [
  { ceiling: 2428.8, rate: 0, deduction: 0 },
  { ceiling: 2826.65, rate: 0.075, deduction: 182.16 },
  { ceiling: 3751.05, rate: 0.15, deduction: 394.16 },
  { ceiling: 4664.68, rate: 0.225, deduction: 675.49 },
  { ceiling: Infinity, rate: 0.275, deduction: 908.73 },
]

// 2026 exemption: gross <= R$ 5,000 is fully exempt;
// gross R$ 5,000.01–7,350 gets a gradual tax reduction.
const EXEMPTION_CEILING = 5000
const REDUCTION_CEILING = 7350
const REDUCTION_CONSTANT = 978.62
const REDUCTION_FACTOR = 0.133145

function calculateIRRFFromTable(taxableBase: number): number {
  for (const bracket of IRRF_BRACKETS) {
    if (taxableBase <= bracket.ceiling) {
      const tax = taxableBase * bracket.rate - bracket.deduction
      return Math.max(0, Math.round(tax * 100) / 100)
    }
  }
  return 0
}

export function calculateIRRF(taxableBase: number, grossSalary?: number): number {
  const gross = grossSalary ?? taxableBase
  if (gross <= EXEMPTION_CEILING) return 0

  const tax = calculateIRRFFromTable(taxableBase)

  if (gross <= REDUCTION_CEILING) {
    const reduction = Math.max(0, REDUCTION_CONSTANT - REDUCTION_FACTOR * gross)
    return Math.max(0, Math.round((tax - reduction) * 100) / 100)
  }

  return tax
}

export function calculateNetSalary(gross: number): number {
  const inss = calculateINSS(gross)
  const irrf = calculateIRRF(gross - inss, gross)
  return Math.round((gross - inss - irrf) * 100) / 100
}

export interface AnnualBonuses {
  thirteenthGross: number
  thirteenthNet: number
  vacationThirdGross: number
  vacationThirdNet: number
  totalNet: number
}

/**
 * Calculate monthly income for a CLT worker (regular month only — no bonuses).
 * @param grossSalary - monthly gross salary
 * @param otherDeductions - total of other monthly deductions (e.g. union contributions)
 */
export function calculateMonthlyIncome(grossSalary: number, otherDeductions: number = 0): MonthlyIncome {
  const inss = calculateINSS(grossSalary)
  const irrf = calculateIRRF(grossSalary - inss, grossSalary)
  const netIncome = grossSalary - inss - irrf - otherDeductions

  return {
    grossBeforeTax: grossSalary,
    inss: Math.round(inss * 100) / 100,
    irrf: Math.round(irrf * 100) / 100,
    otherDeductions: Math.round(otherDeductions * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
  }
}

/**
 * Calculate annual bonuses (13th salary + vacation 1/3) as December lump sums.
 */
export function calculateAnnualBonuses(grossSalary: number): AnnualBonuses {
  const thirteenthGross = grossSalary
  const thirteenthINSS = calculateINSS(thirteenthGross)
  const thirteenthIRRF = calculateIRRF(thirteenthGross - thirteenthINSS, thirteenthGross)
  const thirteenthNet = Math.round((thirteenthGross - thirteenthINSS - thirteenthIRRF) * 100) / 100

  const vacationThirdGross = Math.round((grossSalary / 3) * 100) / 100
  const vacationThirdINSS = calculateINSS(vacationThirdGross)
  const vacationThirdIRRF = calculateIRRF(vacationThirdGross - vacationThirdINSS, vacationThirdGross)
  const vacationThirdNet = Math.round((vacationThirdGross - vacationThirdINSS - vacationThirdIRRF) * 100) / 100

  return {
    thirteenthGross,
    thirteenthNet,
    vacationThirdGross,
    vacationThirdNet,
    totalNet: Math.round((thirteenthNet + vacationThirdNet) * 100) / 100,
  }
}
