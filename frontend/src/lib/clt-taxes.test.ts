import { calculateINSS, calculateIRRF, calculateNetSalary, calculateMonthlyIncome } from './clt-taxes'

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
  it('includes vacation 1/3 spread in regular month', () => {
    const gross = 10000
    const result = calculateMonthlyIncome(gross, 3) // April
    // grossBeforeTax should include vacation spread
    expect(result.grossBeforeTax).toBeCloseTo(gross + gross / 36, 2)
    expect(result.inss).toBeGreaterThan(0)
    expect(result.irrf).toBeGreaterThan(0)
    expect(result.netIncome).toBeLessThan(result.grossBeforeTax)
  })

  it('adds 13th 1st installment (untaxed) in November', () => {
    const gross = 10000
    const regularMonth = calculateMonthlyIncome(gross, 3) // April
    const november = calculateMonthlyIncome(gross, 10) // November

    // November should have extra gross * 0.5 on top of regular net
    expect(november.netIncome).toBeCloseTo(regularMonth.netIncome + gross * 0.5, 2)
  })

  it('adds 13th 2nd installment (taxed) in December', () => {
    const gross = 10000
    const regularMonth = calculateMonthlyIncome(gross, 3)
    const december = calculateMonthlyIncome(gross, 11)

    // December should have: regular net + (net 13th - 0.5 * gross)
    const thirteenthNet = calculateNetSalary(gross)
    const secondInstallment = thirteenthNet - gross * 0.5
    expect(december.netIncome).toBeCloseTo(regularMonth.netIncome + secondInstallment, 2)
  })

  it('returns consistent INSS/IRRF for regular months', () => {
    const gross = 8000
    const jan = calculateMonthlyIncome(gross, 0)
    const jun = calculateMonthlyIncome(gross, 5)
    expect(jan.inss).toBeCloseTo(jun.inss, 2)
    expect(jan.irrf).toBeCloseTo(jun.irrf, 2)
  })
})
