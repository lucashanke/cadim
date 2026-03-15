import type { ConnectedItem, ManualPosition } from '@/types'

export const STORAGE_KEY = 'pluggy_items'
export const MANUAL_POSITIONS_COOKIE = 'manual_investment_positions'

export function getManualPositions(): ManualPosition[] {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${MANUAL_POSITIONS_COOKIE}=([^;]*)`))
    if (!match) return []
    return JSON.parse(decodeURIComponent(match[1])) ?? []
  } catch { return [] }
}

export function saveManualPositions(positions: ManualPosition[]) {
  try {
    document.cookie = `${MANUAL_POSITIONS_COOKIE}=${encodeURIComponent(JSON.stringify(positions))}; path=/; max-age=31536000; SameSite=Lax`
  } catch (e) { console.warn('Could not save manual positions', e) }
}

export const SALARY_CONFIG_COOKIE = 'salary_config'

export function getSalaryConfig(): { grossSalary: number } | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SALARY_CONFIG_COOKIE}=([^;]*)`))
    if (!match) return null
    return JSON.parse(decodeURIComponent(match[1])) ?? null
  } catch { return null }
}

export function saveSalaryConfig(config: { grossSalary: number }) {
  try {
    document.cookie = `${SALARY_CONFIG_COOKIE}=${encodeURIComponent(JSON.stringify(config))}; path=/; max-age=31536000; SameSite=Lax`
  } catch (e) { console.warn('Could not save salary config', e) }
}

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

export function storeItems(items: ConnectedItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
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
