import type { ConnectedItem, ManualPosition } from '@/types'

export const STORAGE_KEY = 'pluggy_items'
export const MANUAL_POSITIONS_COOKIE = 'manual_investment_positions'
export const SALARY_CONFIG_COOKIE = 'salary_config'

// Cookie readers — kept for one-time migration to API, not for regular use

export function getManualPositions(): ManualPosition[] {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${MANUAL_POSITIONS_COOKIE}=([^;]*)`))
    if (!match) return []
    return JSON.parse(decodeURIComponent(match[1])) ?? []
  } catch { return [] }
}

export interface SalaryDeduction {
  name: string
  amount: number
}

export interface SalaryConfig {
  grossSalary: number
  deductions?: SalaryDeduction[]
  thirteenthReceived?: number
  vacationThirdReceived?: number
  bonusYear?: number
  compoundSavings?: boolean
}

export function getSalaryConfig(): SalaryConfig | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SALARY_CONFIG_COOKIE}=([^;]*)`))
    if (!match) return null
    return JSON.parse(decodeURIComponent(match[1])) ?? null
  } catch { return null }
}

// localStorage reader — kept for one-time migration to API

export function getStoredItems(): ConnectedItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function fetchItemName(itemId: string): Promise<string> {
  try {
    const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`)
    if (!res.ok) return 'Unknown'
    const data = await res.json()
    return data.connector_name || 'Unknown'
  } catch {
    return 'Unknown'
  }
}
