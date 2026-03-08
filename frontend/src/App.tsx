import { useState, useEffect, useCallback } from 'react'
import { PluggyConnect } from 'react-pluggy-connect'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, CreditCard, DollarSign, Building, AlertCircle, Trash2, PlusCircle, LogOut } from 'lucide-react'
import './App.css'

interface HealthStatus {
  status: string
  message: string
}

interface AccountsSummary {
  total_balance: number
  currency_code: string
  account_count: number
}

interface ConnectedItem {
  id: string
  name: string
}

const STORAGE_KEY = 'pluggy_items'

function getStoredItems(): ConnectedItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function storeItems(items: ConnectedItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

async function fetchItemName(itemId: string): Promise<string> {
  try {
    const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`)
    if (!res.ok) return 'Unknown'
    const data = await res.json()
    return data.connector_name || 'Unknown'
  } catch {
    return 'Unknown'
  }
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [accountsSummary, setAccountsSummary] = useState<AccountsSummary | null>(null)
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)
  const [items, setItems] = useState<ConnectedItem[]>(getStoredItems)
  const [loading, setLoading] = useState(true)
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  
  const handleRemoveItem = async (idToRemove: string) => {
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(idToRemove)}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || `Failed to delete item (HTTP ${res.status})`)
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
      return
    }

    setItems((prev) => {
      const updated = prev.filter((item) => item.id !== idToRemove)
      storeItems(updated)
      if (updated.length === 0) {
        setAccountsSummary(null)
        setAccountsError(null)
      }
      return updated
    })
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
    storeItems([])
  }

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(value)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-muted/40 shrink-0">
        <div className="flex h-16 items-center border-b px-6">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold font-sans">c</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">cadim</h2>
            <Badge variant="outline" className="font-mono text-[10px] py-0 px-1">
              Beta
            </Badge>
          </div>
        </div>
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid items-start px-4 text-sm font-medium">
            <Button variant="ghost" className="justify-start gap-2 bg-muted text-foreground">
              <Activity className="h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:text-foreground">
              <CreditCard className="h-4 w-4" />
              Overview
            </Button>
            <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:text-foreground">
              <Activity className="h-4 w-4" />
              Analytics
            </Button>
            <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:text-foreground">
              <Building className="h-4 w-4" />
              Institutions
            </Button>
            <div className="mt-8 px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              System
            </div>
            <Button variant="ghost" className="justify-start gap-2 text-muted-foreground hover:text-foreground">
              <Activity className="h-4 w-4" />
              Status
            </Button>
          </nav>
        </div>
        <div className="mt-auto p-4 border-t">
          <div className="flex items-center gap-3 px-2 py-1">
             <div className="h-8 w-8 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs">LH</div>
             <div className="flex flex-col">
               <span className="text-sm font-medium line-clamp-1">Lucas Hanke</span>
               <span className="text-xs text-muted-foreground line-clamp-1">Pro Plan</span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center gap-4 border-b bg-muted/40 px-8 shrink-0">
          <div className="w-full flex-1">
            <form>
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search assets, items, transactions..."
                  className="w-full md:w-[300px] lg:w-[400px] h-9"
                />
              </div>
            </form>
          </div>
          <div className="flex items-center space-x-4">
            <Avatar className="h-8 w-8 border">
              <AvatarImage src="/avatars/01.png" alt="@user" />
              <AvatarFallback>LH</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <div className="flex items-center space-x-2">
              <Button onClick={handleConnectBank} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Connect Bank
              </Button>
              {items.length > 0 && (
                <Button variant="destructive" onClick={handleDisconnectAll} size="sm">
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect All
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-8">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {accountsError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sync Error</AlertTitle>
                <AlertDescription>
                  {accountsError}
                  <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={() => fetchAllAccounts(items)}>
                    Retry Sync
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {accountsLoading ? (
                      <Skeleton className="h-8 w-32" />
                    ) : accountsSummary ? (
                      formatCurrency(accountsSummary.total_balance, accountsSummary.currency_code)
                    ) : (
                      'R$ 0,00'
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {items.length === 0 ? "Connect an account to see balance" : "Available across all accounts"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {accountsLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      accountsSummary?.account_count || 0
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From {items.length} institution{items.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Transactions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Feature coming soon
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {loading ? (
                      <Skeleton className="h-6 w-24" />
                    ) : (
                      <>
                        <span className="relative flex h-3 w-3">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${health?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                          <span className={`relative inline-flex rounded-full h-3 w-3 ${health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </span>
                        <div className="text-sm font-medium">
                          {health?.status === 'ok' ? 'Systems Operational' : 'Offline'}
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {health?.message || 'Connecting to backend...'}
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Cash Flow Overview</CardTitle>
                  <CardDescription>
                    Your inflows and outflows for the current month.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2 flex items-center justify-center min-h-[300px]">
                   <div className="text-center">
                     <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                     <p className="text-sm text-muted-foreground">Chart visualization will appear here</p>
                   </div>
                </CardContent>
              </Card>

              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Connected Institutions</CardTitle>
                  <CardDescription>
                    Manage your active bank connections.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-10 space-y-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Building className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground max-w-[200px]">
                        No institutions connected yet. Connect your first bank to see data.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleConnectBank}>
                        Connect Now
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <Building className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium leading-none">{item.name}</p>
                              <p className="text-sm text-muted-foreground mt-1">Connected</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remove connection"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {showWidget && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={handleSuccess}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

export default App
