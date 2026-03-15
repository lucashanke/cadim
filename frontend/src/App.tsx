import { useState, useEffect, useCallback } from 'react'
import { PluggyConnect } from 'react-pluggy-connect'
import { AppSidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CreditCardsPage } from '@/components/CreditCardsPage'
import { DashboardPage } from '@/components/DashboardPage'
import { InvestmentsPage } from '@/components/InvestmentsPage'
import { AddManualPositionModal } from '@/components/modals/AddManualPositionModal'
import { EditManualPositionModal } from '@/components/modals/EditManualPositionModal'
import { INVESTMENT_TYPE_LABELS, SUBTYPE_LABELS } from '@/constants/investments'
import { getStoredItems, storeItems, getManualPositions, saveManualPositions, fetchItemName } from '@/lib/storage'
import { formatCurrency } from '@/lib/format'
import type { HealthStatus, AccountsSummary, InvestmentsSummary, InvestmentPosition, ConnectedItem, ManualPosition, Page, CreditCardAccount } from '@/types'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [accountsSummary, setAccountsSummary] = useState<AccountsSummary | null>(null)
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)
  const [items, setItems] = useState<ConnectedItem[]>(getStoredItems)
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
  const [error, setError] = useState<string | null>(null)
  const [manualPositions, setManualPositions] = useState<ManualPosition[]>(getManualPositions)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingManual, setEditingManual] = useState<ManualPosition | null>(null)

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
    const newItem: ConnectedItem = { id: newId, name }

    setItems((prev) => {
      const updated = [...prev, newItem]
      storeItems(updated)
      return updated
    })
  }

  const handleClose = () => {
    setShowWidget(false)
    setConnectToken(null)
  }

  const handleDisconnectAll = async () => {
    try {
      await Promise.all(
        items.map((item) =>
          fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
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
    storeItems([])
  }

  const handleSaveManual = (data: { investment_type: string; subtype: string; amount: number; due_date: string | null }) => {
    const newPos: ManualPosition = { id: 'manual_' + Date.now(), ...data }
    const updated = [...getManualPositions(), newPos]
    saveManualPositions(updated)
    setManualPositions(updated)
    setShowAddModal(false)
  }

  const handleUpdateManual = (id: string, amount: number) => {
    const updated = getManualPositions().map(p => p.id === id ? { ...p, amount } : p)
    saveManualPositions(updated)
    setManualPositions(updated)
    setEditingManual(null)
  }

  const handleRemoveManual = (id: string) => {
    const updated = getManualPositions().filter(p => p.id !== id)
    saveManualPositions(updated)
    setManualPositions(updated)
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
      <AppSidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <SidebarInset className="overflow-hidden">
        <Header />

        <div className="flex-1 overflow-auto p-8">
          {currentPage === 'investments' && (
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
          )}
          {currentPage === 'credit-cards' && (
            <CreditCardsPage
              items={items}
              creditCards={creditCards}
              loading={creditCardsLoading}
              error={creditCardsError}
              onRetry={() => fetchAllCreditCards(items)}
              formatCurrency={formatCurrency}
            />
          )}
          {currentPage === 'dashboard' && (
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
            />
          )}
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

export default App
