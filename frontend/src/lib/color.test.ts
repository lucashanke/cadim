import { describe, it, expect } from 'vitest'
import { hexToHsl, hslToHex, subtypeColor } from './color'

describe('hexToHsl', () => {
  it('converts pure red correctly', () => {
    const [h, s, l] = hexToHsl('#ff0000')
    expect(h).toBeCloseTo(0, 0)
    expect(s).toBeCloseTo(100, 0)
    expect(l).toBeCloseTo(50, 0)
    void h // h is checked via expect above
  })

  it('converts white correctly', () => {
    const [_h, s, l] = hexToHsl('#ffffff')
    expect(s).toBeCloseTo(0, 0)
    expect(l).toBeCloseTo(100, 0)
  })

  it('converts black correctly', () => {
    const [_h, s, l] = hexToHsl('#000000')
    expect(s).toBeCloseTo(0, 0)
    expect(l).toBeCloseTo(0, 0)
  })
})

describe('hslToHex / hexToHsl round-trip', () => {
  it('round-trips a known investment color', () => {
    const original = '#e09020' // FIXED_INCOME color
    const [h, s, l] = hexToHsl(original)
    const result = hslToHex(h, s, l)
    expect(result).toBe(original)
  })

  it('round-trips blue', () => {
    const original = '#4080d0'
    const [h, s, l] = hexToHsl(original)
    const result = hslToHex(h, s, l)
    expect(result).toBe(original)
  })
})

describe('subtypeColor', () => {
  it('returns fallback for unknown subtype', () => {
    expect(subtypeColor('UNKNOWN_SUBTYPE')).toBe('#6880a0')
  })

  it('returns a hex color in the FIXED_INCOME hue family for CDB', () => {
    const color = subtypeColor('CDB')
    // Must be a valid hex
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
    // Hue should be close to the FIXED_INCOME base (#e09020 → ~orange/gold hue)
    const [h] = hexToHsl(color)
    const [baseH] = hexToHsl('#e09020')
    expect(Math.abs(h - baseH)).toBeLessThan(5)
  })
})
