import { useState, useEffect, useCallback } from 'react'
import { PluggyConnect } from 'react-pluggy-connect'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { DashboardPage } from '@/components/DashboardPage'
import { InvestmentsPage } from '@/components/InvestmentsPage'
import { AddManualPositionModal } from '@/components/modals/AddManualPositionModal'
import { EditManualPositionModal } from '@/components/modals/EditManualPositionModal'
import { INVESTMENT_TYPE_LABELS, SUBTYPE_LABELS } from '@/constants/investments'
import { getStoredItems, storeItems, getManualPositions, saveManualPositions, fetchItemName } from '@/lib/storage'
import type { HealthStatus, AccountsSummary, InvestmentsSummary, InvestmentPosition, ConnectedItem, ManualPosition, Page } from '@/types'
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
      const results = await Promise.all(
        connectedItems.map(async (item) => {
          const res = await fetch(`/api/accounts/${encodeURIComponent(item.id)}/summary`)
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || `HTTP ${res.status} for ${item.name}`)
          }
          return res.json() as Promise<AccountsSummary>
        })
      )

      const aggregated: AccountsSummary = {
        total_balance: results.reduce((sum, r) => sum + r.total_balance, 0),
        currency_code: results[0]?.currency_code ?? 'BRL',
        account_count: results.reduce((sum, r) => sum + r.account_count, 0),
      }
      setAccountsSummary(aggregated)
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
      const results = await Promise.all(
        connectedItems.map(async (item) => {
          const res = await fetch(`/api/investments/${encodeURIComponent(item.id)}/summary`)
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || `HTTP ${res.status} for ${item.name}`)
          }
          return res.json() as Promise<InvestmentsSummary>
        })
      )
      setInvestmentsSummary({
        total_gross_amount: results.reduce((sum, r) => sum + r.total_gross_amount, 0),
        currency_code: results[0]?.currency_code ?? 'BRL',
        investment_count: results.reduce((sum, r) => sum + r.investment_count, 0),
      })
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

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(value)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main className="flex-1 overflow-auto p-8">
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
        </main>
      </div>

      {showWidget && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={handleSuccess}
          onClose={handleClose}
        />
      )}
      <AddManualPositionModal open={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleSaveManual} />
      <EditManualPositionModal position={editingManual} onClose={() => setEditingManual(null)} onSave={handleUpdateManual} />
    </div>
  )
}

export default App
