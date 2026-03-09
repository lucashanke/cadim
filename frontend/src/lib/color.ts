import { INVESTMENT_TYPE_COLORS, SUBTYPE_PARENT_TYPE, SUBTYPE_SIBLINGS } from '@/constants/investments'

export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s * 100, l * 100]
}

export function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r, g, b
  if (s === 0) { r = g = b = l } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3)
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// Returns a lightness-shifted shade of the parent type color for a given subtype
export function subtypeColor(subtype: string): string {
  const parentType = SUBTYPE_PARENT_TYPE[subtype]
  if (!parentType) return '#6880a0'
  const baseHex = INVESTMENT_TYPE_COLORS[parentType] ?? '#6880a0'
  const siblings = SUBTYPE_SIBLINGS[parentType] ?? [subtype]
  const idx = siblings.indexOf(subtype)
  const total = siblings.length
  const [h, s, l] = hexToHsl(baseHex)
  // Spread lightness ±half-spread around the base; more siblings → wider spread, capped at 36%
  const spread = Math.min(36, total * 5)
  const newL = l - spread / 2 + (idx / Math.max(total - 1, 1)) * spread
  return hslToHex(h, s, Math.max(28, Math.min(72, newL)))
}

// Derives badge inline styles from a hex color so table badges always match chart colors
export function colorBadgeStyle(hex: string) {
  return { background: hex + '18', color: hex, borderColor: hex + '45' }
}
