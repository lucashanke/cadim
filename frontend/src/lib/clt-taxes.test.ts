import { calculateINSS, calculateIRRF, calculateNetSalary, calculateMonthlyIncome, calculateAnnualBonuses } from './clt-taxes'

describe('calculateINSS', () => {
  it('calculates for income in first bracket', () => {
    expect(calculateINSS(1500)).toBeCloseTo(1500 * 0.075, 2)
  })

  it('calculates at first bracket ceiling', () => {
    expect(calculateINSS(1518)).toBeCloseTo(1518 * 0.075, 2)
  })

  it('calculates for income in second bracket', () => {
    // 1518 * 7.5% + (2000 - 1518) * 9%
    const expected = 1518 * 0.075 + (2000 - 1518) * 0.09
    expect(calculateINSS(2000)).toBeCloseTo(expected, 2)
  })

  it('calculates for income in third bracket', () => {
    const expected = 1518 * 0.075 + (2793.88 - 1518) * 0.09 + (3500 - 2793.88) * 0.12
    expect(calculateINSS(3500)).toBeCloseTo(expected, 2)
  })

  it('calculates for income in fourth bracket', () => {
    const expected =
      1518 * 0.075 +
      (2793.88 - 1518) * 0.09 +
      (4190.83 - 2793.88) * 0.12 +
      (5000 - 4190.83) * 0.14
    expect(calculateINSS(5000)).toBeCloseTo(expected, 2)
  })

  it('caps at ceiling contribution', () => {
    const ceilingContribution =
      1518 * 0.075 +
      (2793.88 - 1518) * 0.09 +
      (4190.83 - 2793.88) * 0.12 +
      (8157.41 - 4190.83) * 0.14
    expect(calculateINSS(8157.41)).toBeCloseTo(ceilingContribution, 2)
    expect(calculateINSS(20000)).toBeCloseTo(ceilingContribution, 2)
    expect(calculateINSS(50000)).toBeCloseTo(ceilingContribution, 2)
  })
})

describe('calculateIRRF', () => {
  it('returns 0 for exempt range', () => {
    expect(calculateIRRF(2000)).toBe(0)
    expect(calculateIRRF(2259.2)).toBe(0)
  })

  it('calculates for second bracket', () => {
    const base = 2500
    const expected = base * 0.075 - 169.44
    expect(calculateIRRF(base)).toBeCloseTo(expected, 2)
  })

  it('calculates for third bracket', () => {
    const base = 3000
    const expected = base * 0.15 - 381.44
    expect(calculateIRRF(base)).toBeCloseTo(expected, 2)
  })

  it('calculates for fourth bracket', () => {
    const base = 4000
    const expected = base * 0.225 - 662.77
    expect(calculateIRRF(base)).toBeCloseTo(expected, 2)
  })

  it('calculates for highest bracket', () => {
    const base = 10000
    const expected = base * 0.275 - 896.0
    expect(calculateIRRF(base)).toBeCloseTo(expected, 2)
  })
})

describe('calculateNetSalary', () => {
  it('calculates net for a known gross salary', () => {
    const gross = 10000
    const inss = calculateINSS(gross)
    const irrf = calculateIRRF(gross - inss)
    expect(calculateNetSalary(gross)).toBeCloseTo(gross - inss - irrf, 2)
  })

  it('returns full salary when below tax thresholds', () => {
    // Very low salary: only INSS applies, IRRF is exempt
    const gross = 1500
    const inss = calculateINSS(gross)
    expect(calculateNetSalary(gross)).toBeCloseTo(gross - inss, 2)
  })
})

describe('calculateMonthlyIncome', () => {
  it('calculates regular month income (gross minus taxes and deductions)', () => {
    const gross = 10000
    const result = calculateMonthlyIncome(gross)
    // grossBeforeTax should be the plain gross salary (no vacation spread)
    expect(result.grossBeforeTax).toBe(gross)
    expect(result.inss).toBeGreaterThan(0)
    expect(result.irrf).toBeGreaterThan(0)
    expect(result.netIncome).toBeCloseTo(gross - result.inss - result.irrf, 2)
  })

  it('subtracts other deductions from net income', () => {
    const gross = 10000
    const withoutDeductions = calculateMonthlyIncome(gross)
    const withDeductions = calculateMonthlyIncome(gross, 500)

    expect(withDeductions.otherDeductions).toBe(500)
    expect(withDeductions.netIncome).toBeCloseTo(withoutDeductions.netIncome - 500, 2)
    // Taxes should be unchanged
    expect(withDeductions.inss).toBeCloseTo(withoutDeductions.inss, 2)
    expect(withDeductions.irrf).toBeCloseTo(withoutDeductions.irrf, 2)
  })
})

describe('calculateAnnualBonuses', () => {
  it('calculates 13th salary net correctly', () => {
    const gross = 10000
    const bonuses = calculateAnnualBonuses(gross)
    expect(bonuses.thirteenthGross).toBe(gross)
    expect(bonuses.thirteenthNet).toBe(calculateNetSalary(gross))
  })

  it('calculates vacation 1/3 net correctly', () => {
    const gross = 10000
    const bonuses = calculateAnnualBonuses(gross)
    const vacGross = Math.round((gross / 3) * 100) / 100
    expect(bonuses.vacationThirdGross).toBeCloseTo(vacGross, 2)
    expect(bonuses.vacationThirdNet).toBe(calculateNetSalary(vacGross))
  })

  it('totalNet equals thirteenthNet + vacationThirdNet', () => {
    const bonuses = calculateAnnualBonuses(10000)
    expect(bonuses.totalNet).toBeCloseTo(bonuses.thirteenthNet + bonuses.vacationThirdNet, 2)
  })

  it('handles low salary (below tax thresholds)', () => {
    const bonuses = calculateAnnualBonuses(1500)
    expect(bonuses.thirteenthNet).toBeGreaterThan(0)
    expect(bonuses.thirteenthNet).toBeLessThan(1500)
    expect(bonuses.vacationThirdNet).toBeGreaterThan(0)
    expect(bonuses.vacationThirdNet).toBeLessThan(500)
  })
})
