import { calculateINSS, calculateIRRF, calculateNetSalary, calculateMonthlyIncome, calculateAnnualBonuses } from './clt-taxes'

describe('calculateINSS', () => {
  it('calculates for income in first bracket', () => {
    expect(calculateINSS(1500)).toBeCloseTo(1500 * 0.075, 2)
  })

  it('calculates at first bracket ceiling', () => {
    expect(calculateINSS(1621)).toBeCloseTo(1621 * 0.075, 2)
  })

  it('calculates for income in second bracket', () => {
    // 1621 * 7.5% + (2000 - 1621) * 9%
    const expected = 1621 * 0.075 + (2000 - 1621) * 0.09
    expect(calculateINSS(2000)).toBeCloseTo(expected, 2)
  })

  it('calculates for income in third bracket', () => {
    const expected = 1621 * 0.075 + (2902.84 - 1621) * 0.09 + (3500 - 2902.84) * 0.12
    expect(calculateINSS(3500)).toBeCloseTo(expected, 2)
  })

  it('calculates for income in fourth bracket', () => {
    const expected =
      1621 * 0.075 +
      (2902.84 - 1621) * 0.09 +
      (4354.27 - 2902.84) * 0.12 +
      (5000 - 4354.27) * 0.14
    expect(calculateINSS(5000)).toBeCloseTo(expected, 2)
  })

  it('caps at ceiling contribution', () => {
    const ceilingContribution =
      1621 * 0.075 +
      (2902.84 - 1621) * 0.09 +
      (4354.27 - 2902.84) * 0.12 +
      (8475.55 - 4354.27) * 0.14
    expect(calculateINSS(8475.55)).toBeCloseTo(ceilingContribution, 2)
    expect(calculateINSS(20000)).toBeCloseTo(ceilingContribution, 2)
    expect(calculateINSS(50000)).toBeCloseTo(ceilingContribution, 2)
  })
})

describe('calculateIRRF', () => {
  it('returns 0 for exempt range', () => {
    expect(calculateIRRF(2000)).toBe(0)
    expect(calculateIRRF(2428.8)).toBe(0)
  })

  it('calculates for second bracket (no exemption)', () => {
    const base = 2500
    const expected = base * 0.075 - 182.16
    expect(calculateIRRF(base, 8000)).toBeCloseTo(expected, 2)
  })

  it('calculates for third bracket (no exemption)', () => {
    const base = 3000
    const expected = base * 0.15 - 394.16
    expect(calculateIRRF(base, 8000)).toBeCloseTo(expected, 2)
  })

  it('calculates for fourth bracket (no exemption)', () => {
    const base = 4000
    const expected = base * 0.225 - 675.49
    expect(calculateIRRF(base, 8000)).toBeCloseTo(expected, 2)
  })

  it('calculates for highest bracket', () => {
    const base = 10000
    const expected = base * 0.275 - 908.73
    expect(calculateIRRF(base, 15000)).toBeCloseTo(expected, 2)
  })

  it('returns 0 for gross salary up to R$ 5,000 (2026 exemption)', () => {
    expect(calculateIRRF(4500, 5000)).toBe(0)
    expect(calculateIRRF(3500, 4000)).toBe(0)
    expect(calculateIRRF(4000, 4500)).toBe(0)
  })

  it('applies gradual reduction for gross between R$ 5,000 and R$ 7,350', () => {
    const gross = 6000
    const inss = calculateINSS(gross)
    const base = gross - inss
    // Calculate table tax: base ~5,487 falls in the 27.5% bracket
    const noExemptionTax = calculateIRRF(base, 8000) // pass high gross to skip reduction
    const reduction = 978.62 - 0.133145 * gross
    const expected = Math.max(0, noExemptionTax - reduction)
    expect(calculateIRRF(base, gross)).toBeCloseTo(expected, 2)
  })

  it('applies no reduction for gross above R$ 7,350', () => {
    const gross = 10000
    const inss = calculateINSS(gross)
    const base = gross - inss
    const tableTax = base * 0.275 - 908.73
    expect(calculateIRRF(base, gross)).toBeCloseTo(tableTax, 2)
  })

  it('reduction reaches zero at R$ 7,350', () => {
    const reduction = 978.62 - 0.133145 * 7350
    expect(reduction).toBeCloseTo(0, 2)
  })
})

describe('calculateNetSalary', () => {
  it('calculates net for a known gross salary', () => {
    const gross = 10000
    const inss = calculateINSS(gross)
    const irrf = calculateIRRF(gross - inss, gross)
    expect(calculateNetSalary(gross)).toBeCloseTo(gross - inss - irrf, 2)
  })

  it('returns gross minus INSS only when below IRRF threshold', () => {
    const gross = 1500
    const inss = calculateINSS(gross)
    expect(calculateNetSalary(gross)).toBeCloseTo(gross - inss, 2)
  })

  it('returns gross minus INSS only for R$ 5,000 (2026 exemption)', () => {
    const gross = 5000
    const inss = calculateINSS(gross)
    // IRRF should be 0 due to the exemption
    expect(calculateNetSalary(gross)).toBeCloseTo(gross - inss, 2)
  })
})

describe('calculateMonthlyIncome', () => {
  it('calculates regular month income (gross minus taxes and deductions)', () => {
    const gross = 10000
    const result = calculateMonthlyIncome(gross)
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
    expect(withDeductions.inss).toBeCloseTo(withoutDeductions.inss, 2)
    expect(withDeductions.irrf).toBeCloseTo(withoutDeductions.irrf, 2)
  })

  it('has zero IRRF for gross up to R$ 5,000', () => {
    const result = calculateMonthlyIncome(5000)
    expect(result.irrf).toBe(0)
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
