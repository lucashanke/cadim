import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PluggyConnect } from 'react-pluggy-connect'
import { AppSidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CreditCardsPage } from '@/components/CreditCardsPage'
import { DashboardPage } from '@/components/DashboardPage'
import { InvestmentsPage } from '@/components/InvestmentsPage'
import { ProjectionsPage } from '@/components/ProjectionsPage'
import { AddManualPositionModal } from '@/components/modals/AddManualPositionModal'
import { EditManualPositionModal } from '@/components/modals/EditManualPositionModal'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { INVESTMENT_TYPE_LABELS, SUBTYPE_LABELS } from '@/constants/investments'
import { getStoredItems, fetchItemName, getManualPositions, getSalaryConfig, MANUAL_POSITIONS_COOKIE, SALARY_CONFIG_COOKIE, STORAGE_KEY } from '@/lib/storage'
import { formatCurrency } from '@/lib/format'
import * as api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { HealthStatus, AccountsSummary, InvestmentsSummary, InvestmentPosition, ConnectedItem, ManualPosition, CreditCardAccount, BillingCycle } from '@/types'
import './App.css'

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

function AuthenticatedApp() {
  const { logout } = useAuth()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [accountsSummary, setAccountsSummary] = useState<AccountsSummary | null>(null)
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)
  const [items, setItems] = useState<ConnectedItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [investmentsSummary, setInvestmentsSummary] = useState<InvestmentsSummary | null>(null)
  const [investmentsLoading, setInvestmentsLoading] = useState(false)
  const [investmentsError, setInvestmentsError] = useState<string | null>(null)
  const [investmentPositions, setInvestmentPositions] = useState<InvestmentPosition[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [positionsError, setPositionsError] = useState<string | null>(null)
  const [creditCards, setCreditCards] = useState<CreditCardAccount[]>([])
  const [creditCardsLoading, setCreditCardsLoading] = useState(false)
  const [creditCardsError, setCreditCardsError] = useState<string | null>(null)
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([])
  const [billingCyclesLoading, setBillingCyclesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualPositions, setManualPositions] = useState<ManualPosition[]>([])
  const [manualPositionsLoading, setManualPositionsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingManual, setEditingManual] = useState<ManualPosition | null>(null)

  // Load manual positions from API
  useEffect(() => {
    async function loadPositions() {
      try {
        const positions = await api.getPositions()
        setManualPositions(positions.map(p => ({
          id: p.id,
          investment_type: p.investment_type,
          subtype: p.subtype,
          amount: p.amount,
          due_date: p.due_date,
        })))
      } catch (err) {
        if (err instanceof api.UnauthorizedError) {
          logout()
          return
        }
        console.warn('Failed to load positions from API', err)
      } finally {
        setManualPositionsLoading(false)
      }
    }
    loadPositions()
  }, [logout])

  // Load pluggy items from API
  useEffect(() => {
    async function loadItems() {
      try {
        const apiItems = await api.getPluggyItems()
        setItems(apiItems.map(i => ({ id: i.pluggy_item_id, name: i.connector_name })))
      } catch (err) {
        if (err instanceof api.UnauthorizedError) {
          logout()
          return
        }
        console.warn('Failed to load pluggy items from API', err)
      } finally {
        setItemsLoading(false)
      }
    }
    loadItems()
  }, [logout])

  // Local storage/cookie-to-DB migration: migrate old data on first load
  useEffect(() => {
    if (manualPositionsLoading || itemsLoading) return

    async function migrateLocalData() {
      // Migrate manual positions from cookies
      const cookiePositions = getManualPositions()
      if (cookiePositions.length > 0) {
        try {
          const created = await Promise.all(
            cookiePositions.map(p =>
              api.createPosition({
                investment_type: p.investment_type,
                subtype: p.subtype,
                amount: p.amount,
                due_date: p.due_date,
              })
            )
          )
          setManualPositions(prev => [
            ...prev,
            ...created.map(p => ({
              id: p.id,
              investment_type: p.investment_type,
              subtype: p.subtype,
              amount: p.amount,
              due_date: p.due_date,
            })),
          ])
          clearCookie(MANUAL_POSITIONS_COOKIE)
        } catch (err) {
          console.warn('Failed to migrate manual positions', err)
        }
      }

      // Migrate salary config from cookies
      const cookieConfig = getSalaryConfig()
      if (cookieConfig) {
        try {
          await api.saveCompensationConfig({
            grossSalary: cookieConfig.grossSalary,
            deductions: cookieConfig.deductions ?? [],
            thirteenthReceived: cookieConfig.thirteenthReceived ?? 0,
            vacationThirdReceived: cookieConfig.vacationThirdReceived ?? 0,
            bonusYear: cookieConfig.bonusYear ?? null,
            compoundSavings: cookieConfig.compoundSavings ?? false,
          })
          clearCookie(SALARY_CONFIG_COOKIE)
        } catch (err) {
          console.warn('Failed to migrate salary config', err)
        }
      }

      // Migrate pluggy items from localStorage
      const lsItems = getStoredItems()
      if (lsItems.length > 0) {
        try {
          await Promise.all(
            lsItems.map(item =>
              api.createPluggyItem({ pluggy_item_id: item.id, connector_name: item.name })
            )
          )
          setItems(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const newItems = lsItems.filter(i => !existingIds.has(i.id))
            return [...prev, ...newItems]
          })
          localStorage.removeItem(STORAGE_KEY)
        } catch (err) {
          console.warn('Failed to migrate pluggy items', err)
        }
      }
    }

    migrateLocalData()
  }, [manualPositionsLoading, itemsLoading])

  // Fetch health status
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/health')
        if (!res.ok) throw new Error('Failed to fetch health')
        const data: HealthStatus = await res.json()
        setHealth(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  // Fetch and aggregate accounts across all items
  const fetchAllAccounts = useCallback(async (connectedItems: ConnectedItem[]) => {
    if (connectedItems.length === 0) return
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const item_ids = connectedItems.map(i => encodeURIComponent(i.id)).join(',')
      const res = await fetch(`/api/accounts/summary?item_ids=${item_ids}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setAccountsSummary(await res.json() as AccountsSummary)
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      fetchAllAccounts(items)
    }
  }, [items, fetchAllAccounts])

  const fetchAllInvestments = useCallback(async (connectedItems: ConnectedItem[]) => {
    if (connectedItems.length === 0) return
    setInvestmentsLoading(true)
    setInvestmentsError(null)
    try {
      const item_ids = connectedItems.map(i => encodeURIComponent(i.id)).join(',')
      const res = await fetch(`/api/investments/summary?item_ids=${item_ids}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setInvestmentsSummary(await res.json() as InvestmentsSummary)
    } catch (err) {
      setInvestmentsError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setInvestmentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      fetchAllInvestments(items)
    }
  }, [items, fetchAllInvestments])

  const fetchAllPositions = useCallback(async (connectedItems: ConnectedItem[]) => {
    if (connectedItems.length === 0) return
    setPositionsLoading(true)
    setPositionsError(null)
    try {
      const results = await Promise.all(
        connectedItems.map(async (item) => {
          const res = await fetch(`/api/investments/${encodeURIComponent(item.id)}/list`)
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || `HTTP ${res.status} for ${item.name}`)
          }
          return res.json() as Promise<InvestmentPosition[]>
        })
      )
      setInvestmentPositions(results.flat())
    } catch (err) {
      setPositionsError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setPositionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      fetchAllPositions(items)
    }
  }, [items, fetchAllPositions])

  const fetchAllCreditCards = useCallback(async (connectedItems: ConnectedItem[]) => {
    if (connectedItems.length === 0) return
    setCreditCardsLoading(true)
    setCreditCardsError(null)
    try {
      const results = await Promise.all(
        connectedItems.map(async (item) => {
          const res = await fetch(`/api/credit-cards/${encodeURIComponent(item.id)}/list`)
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || `HTTP ${res.status} for ${item.name}`)
          }
          return res.json() as Promise<CreditCardAccount[]>
        })
      )
      setCreditCards(results.flat())
    } catch (err) {
      setCreditCardsError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreditCardsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      fetchAllCreditCards(items)
    }
  }, [items, fetchAllCreditCards])

  // Fetch billing cycles across all credit cards
  useEffect(() => {
    if (creditCards.length === 0) {
      setBillingCycles([])
      return
    }
    let cancelled = false

    const windowFrom = (() => {
      const d = new Date()
      d.setMonth(d.getMonth() - 5)
      d.setDate(1)
      return d.toISOString().split('T')[0]
    })()

    const windowTo = (() => {
      const d = new Date()
      d.setMonth(d.getMonth() + 1)
      d.setDate(0)
      return d.toISOString().split('T')[0]
    })()

    async function fetchCycles() {
      setBillingCyclesLoading(true)
      try {
        const allCardCycles = await Promise.all(
          creditCards.map(card =>
            fetch(`/api/transactions/${encodeURIComponent(card.id)}/cycles?from=${windowFrom}&to=${windowTo}`)
              .then(async res => {
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}))
                  throw new Error(body.error || `HTTP ${res.status}`)
                }
                return res.json() as Promise<BillingCycle[]>
              })
          )
        )
        if (!cancelled) {
          const merged = new Map<string, BillingCycle>()
          for (const cardCycles of allCardCycles) {
            for (const cycle of cardCycles) {
              const existing = merged.get(cycle.key)
              if (!existing) {
                merged.set(cycle.key, { ...cycle, transactions: [...cycle.transactions] })
              } else {
                existing.transactions = [...existing.transactions, ...cycle.transactions]
                  .sort((a, b) => b.date.localeCompare(a.date))
                existing.total += cycle.total
                const catMap = new Map<string, number>()
                for (const cat of existing.categories) catMap.set(cat.name, cat.amount)
                for (const cat of cycle.categories) catMap.set(cat.name, (catMap.get(cat.name) ?? 0) + cat.amount)
                existing.categories = Array.from(catMap.entries())
                  .map(([name, amount]) => ({ name, amount }))
                  .sort((a, b) => b.amount - a.amount)
              }
            }
          }
          setBillingCycles(Array.from(merged.values()).sort((a, b) => b.key.localeCompare(a.key)))
        }
      } catch {
        // Billing cycle fetch failures are non-critical for dashboard
      } finally {
        if (!cancelled) setBillingCyclesLoading(false)
      }
    }

    fetchCycles()
    return () => { cancelled = true }
  }, [creditCards])

  // Open the Pluggy Connect widget
  const handleConnectBank = async () => {
    try {
      const res = await fetch('/api/connect-token', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setConnectToken(data.access_token)
      setShowWidget(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get connect token')
    }
  }

  const handleSuccess = async (data: { item: { id: string } }) => {
    const newId = data.item.id
    setShowWidget(false)
    setConnectToken(null)

    // Skip if already connected
    if (items.some((item) => item.id === newId)) return

    // Fetch the connector name
    const name = await fetchItemName(newId)
    try {
      await api.createPluggyItem({ pluggy_item_id: newId, connector_name: name })
      setItems((prev) => [...prev, { id: newId, name }])
    } catch (err) {
      console.error('Failed to save connected item', err)
    }
  }

  const handleClose = () => {
    setShowWidget(false)
    setConnectToken(null)
  }

  const handleDisconnectAll = async () => {
    try {
      await Promise.all(
        items.map((item) =>
          Promise.all([
            fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' }),
            api.deletePluggyItem(item.id),
          ])
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete items')
    }

    setItems([])
    setAccountsSummary(null)
    setAccountsError(null)
    setInvestmentsSummary(null)
    setInvestmentsError(null)
    setInvestmentPositions([])
    setPositionsError(null)
    setCreditCards([])
    setCreditCardsError(null)
    setBillingCycles([])
  }

  const handleSaveManual = async (data: { investment_type: string; subtype: string; amount: number; due_date: string | null }) => {
    try {
      const created = await api.createPosition(data)
      setManualPositions(prev => [...prev, {
        id: created.id,
        investment_type: created.investment_type,
        subtype: created.subtype,
        amount: created.amount,
        due_date: created.due_date,
      }])
      setShowAddModal(false)
    } catch (err) {
      console.error('Failed to save position', err)
    }
  }

  const handleUpdateManual = async (id: string, amount: number) => {
    try {
      await api.updatePosition(id, { amount })
      setManualPositions(prev => prev.map(p => p.id === id ? { ...p, amount } : p))
      setEditingManual(null)
    } catch (err) {
      console.error('Failed to update position', err)
    }
  }

  const handleRemoveManual = async (id: string) => {
    try {
      await api.deletePosition(id)
      setManualPositions(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Failed to delete position', err)
    }
  }

  const manualAsPositions: InvestmentPosition[] = manualPositions.map(p => ({
    id: p.id,
    name: p.subtype
      ? (SUBTYPE_LABELS[p.subtype]?.label ?? p.subtype)
      : (INVESTMENT_TYPE_LABELS[p.investment_type]?.label ?? p.investment_type),
    investment_type: p.investment_type,
    subtype: p.subtype ?? null,
    amount: p.amount,
    currency_code: 'BRL',
    date: null,
    due_date: p.due_date,
    rate: null,
    rate_type: null,
    fixed_annual_rate: null,
  }))

  const allPositions = [...investmentPositions, ...manualAsPositions]
  const manualTotal = manualPositions.reduce((sum, p) => sum + p.amount, 0)

  return (
    <SidebarProvider className="h-screen overflow-hidden">
      <TooltipProvider>
      <AppSidebar />

      <SidebarInset className="overflow-hidden">
        <Header />

        <div className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={
              <DashboardPage
                health={health}
                loading={loading}
                accountsSummary={accountsSummary}
                accountsLoading={accountsLoading}
                accountsError={accountsError}
                investmentsSummary={investmentsSummary}
                investmentsLoading={investmentsLoading}
                investmentsError={investmentsError}
                manualTotal={manualTotal}
                error={error}
                items={items}
                formatCurrency={formatCurrency}
                onConnectBank={handleConnectBank}
                onDisconnectAll={handleDisconnectAll}
                onRetryAccounts={() => fetchAllAccounts(items)}
                onRetryInvestments={() => fetchAllInvestments(items)}
                allPositions={allPositions}
                creditCards={creditCards}
                billingCycles={billingCycles}
                billingCyclesLoading={billingCyclesLoading}
              />
            } />
            <Route path="/investments" element={
              <InvestmentsPage
                items={items}
                positions={allPositions}
                loading={positionsLoading}
                error={positionsError}
                onRetry={() => fetchAllPositions(items)}
                formatCurrency={formatCurrency}
                manualPositionIds={new Set(manualPositions.map(p => p.id))}
                onAddPosition={() => setShowAddModal(true)}
                onEditPosition={(pos) => setEditingManual(manualPositions.find(m => m.id === pos.id) ?? null)}
                onRemovePosition={handleRemoveManual}
              />
            } />
            <Route path="/credit-cards" element={
              <CreditCardsPage
                items={items}
                creditCards={creditCards}
                loading={creditCardsLoading}
                error={creditCardsError}
                onRetry={() => fetchAllCreditCards(items)}
                formatCurrency={formatCurrency}
                billingCycles={billingCycles}
                billingCyclesLoading={billingCyclesLoading}
              />
            } />
            <Route path="/projections" element={
              <ProjectionsPage
                positions={allPositions}
                accountsSummary={accountsSummary}
                items={items}
                formatCurrency={formatCurrency}
              />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </SidebarInset>

      {showWidget && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={handleSuccess}
          onClose={handleClose}
        />
      )}
      <AddManualPositionModal open={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleSaveManual} />
      <EditManualPositionModal position={editingManual} onClose={() => setEditingManual(null)} onSave={handleUpdateManual} />
      </TooltipProvider>
    </SidebarProvider>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return <AuthenticatedApp />
}

export default App
