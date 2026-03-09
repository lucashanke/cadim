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
