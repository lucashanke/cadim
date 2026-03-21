const API_BASE = ''

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    throw new UnauthorizedError()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

// Auth
export function login(email: string, password: string) {
  return apiFetch<{ id: string; email: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function register(email: string, password: string) {
  return apiFetch<{ id: string; email: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function getMe() {
  return apiFetch<{ id: string; email: string }>('/api/auth/me')
}

// Positions
export interface ApiPosition {
  id: string
  user_id: string
  investment_type: string
  subtype: string | null
  amount: number
  due_date: string | null
}

export function getPositions() {
  return apiFetch<ApiPosition[]>('/api/positions')
}

export function createPosition(data: {
  investment_type: string
  subtype: string | null
  amount: number
  due_date: string | null
}) {
  return apiFetch<ApiPosition>('/api/positions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updatePosition(id: string, data: { amount: number }) {
  return apiFetch<ApiPosition>(`/api/positions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deletePosition(id: string) {
  return apiFetch<void>(`/api/positions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

// Compensation config
export interface ApiCompensationConfig {
  grossSalary: number
  deductions: { name: string; amount: number }[]
  thirteenthReceived: number
  vacationThirdReceived: number
  bonusYear: number | null
  compoundSavings: boolean
}

export function getCompensationConfig() {
  return apiFetch<ApiCompensationConfig | null>('/api/compensation-config')
}

export function saveCompensationConfig(config: ApiCompensationConfig) {
  return apiFetch<{ ok: boolean }>('/api/compensation-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

// Pluggy Items
export interface ApiPluggyItem {
  id: string
  user_id: string
  pluggy_item_id: string
  connector_name: string
}

export function getPluggyItems() {
  return apiFetch<ApiPluggyItem[]>('/api/pluggy-items')
}

export function createPluggyItem(data: { pluggy_item_id: string; connector_name: string }) {
  return apiFetch<ApiPluggyItem>('/api/pluggy-items', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deletePluggyItem(pluggyItemId: string) {
  return apiFetch<void>(`/api/pluggy-items/${encodeURIComponent(pluggyItemId)}`, {
    method: 'DELETE',
  })
}
