import { useState, useEffect } from 'react'
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
import { getStoredItems, fetchItemName, getManualPositions, getSalaryConfig, MANUAL_POSITIONS_COOKIE, SALARY_CONFIG_COOKIE, STORAGE_KEY } from '@/lib/storage'
import { formatCurrency } from '@/lib/format'
import * as api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { ConnectedItem, ManualPosition } from '@/types'
import './App.css'

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

function AuthenticatedApp() {
  const { logout } = useAuth()
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)
  const [items, setItems] = useState<ConnectedItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [manualPositions, setManualPositions] = useState<ManualPosition[]>([])
  const [manualPositionsLoading, setManualPositionsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingManual, setEditingManual] = useState<ManualPosition | null>(null)
  const [investmentsRefresh, setInvestmentsRefresh] = useState(0)

  // Bootstrap: load items, manual positions, and initial state in a single call
  useEffect(() => {
    async function bootstrap() {
      try {
        const data = await api.getBootstrap()
        setItems(data.items)
        setManualPositions(data.manual_positions)
      } catch (err) {
        if (err instanceof api.UnauthorizedError) {
          logout()
          return
        }
        console.warn('Failed to load bootstrap data', err)
      } finally {
        setItemsLoading(false)
        setManualPositionsLoading(false)
      }
    }
    bootstrap()
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
      console.error('Failed to get connect token', err)
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
      console.error('Failed to delete items', err)
    }

    setItems([])
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
      setInvestmentsRefresh(n => n + 1)
    } catch (err) {
      console.error('Failed to save position', err)
    }
  }

  const handleUpdateManual = async (id: string, amount: number) => {
    try {
      await api.updatePosition(id, { amount })
      setManualPositions(prev => prev.map(p => p.id === id ? { ...p, amount } : p))
      setEditingManual(null)
      setInvestmentsRefresh(n => n + 1)
    } catch (err) {
      console.error('Failed to update position', err)
    }
  }

  const handleRemoveManual = async (id: string) => {
    try {
      await api.deletePosition(id)
      setManualPositions(prev => prev.filter(p => p.id !== id))
      setInvestmentsRefresh(n => n + 1)
    } catch (err) {
      console.error('Failed to delete position', err)
    }
  }

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
                items={items}
                formatCurrency={formatCurrency}
                onConnectBank={handleConnectBank}
                onDisconnectAll={handleDisconnectAll}
              />
            } />
            <Route path="/investments" element={
              <InvestmentsPage
                formatCurrency={formatCurrency}
                onAddPosition={() => setShowAddModal(true)}
                onEditPosition={(pos) => setEditingManual(pos)}
                onRemovePosition={handleRemoveManual}
                refreshTrigger={investmentsRefresh}
              />
            } />
            <Route path="/credit-cards" element={
              <CreditCardsPage
                formatCurrency={formatCurrency}
              />
            } />
            <Route path="/projections" element={
              <ProjectionsPage
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
