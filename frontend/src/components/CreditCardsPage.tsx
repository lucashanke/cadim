import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AlertCircle, CreditCard } from 'lucide-react'
import type { ConnectedItem, CreditCardAccount, TransactionsResponse } from '@/types'
import { getCycleKey, groupByCycle } from '@/lib/billing-cycles'

interface CreditCardsPageProps {
  items: ConnectedItem[]
  creditCards: CreditCardAccount[]
  loading: boolean
  error: string | null
  onRetry: () => void
  formatCurrency: (value: number, currency: string) => string
}


export function CreditCardsPage({
  items,
  creditCards,
  loading,
  error,
  onRetry,
  formatCurrency,
}: CreditCardsPageProps) {
  const [cycles, setCycles] = useState<ReturnType<typeof groupByCycle>>([])
  const [selectedCycle, setSelectedCycle] = useState<string>('')
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)

  const windowFrom = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5)
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })()

  const windowTo = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 7)
    d.setDate(0) // last day of +6 month
    return d.toISOString().split('T')[0]
  })()

  useEffect(() => {
    if (creditCards.length === 0) return
    let cancelled = false

    async function fetchAll() {
      setTransactionsLoading(true)
      setTransactionsError(null)
      try {
        const pages = await Promise.all(
          creditCards.map(card =>
            fetch(`/api/transactions/${encodeURIComponent(card.id)}?page=1&page_size=500&from=${windowFrom}&to=${windowTo}`)
              .then(async res => {
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}))
                  throw new Error(body.error || `HTTP ${res.status}`)
                }
                return res.json() as Promise<TransactionsResponse>
              })
              .then(data => data.results)
          )
        )
        if (!cancelled) {
          setCycles(groupByCycle(pages.flat()))
        }
      } catch (err) {
        if (!cancelled) {
          setTransactionsError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setTransactionsLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [creditCards, windowFrom, windowTo])

  const currentCycleKey = getCycleKey(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (cycles.length === 0) return
    const match = cycles.find(c => c.key === currentCycleKey)
    setSelectedCycle(match ? currentCycleKey : cycles[cycles.length - 1].key)
  }, [cycles])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Cards</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Credit Cards</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="px-0 pb-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <CreditCard className="h-12 w-12 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground/60 max-w-[240px] leading-relaxed">
                Connect a bank to see credit cards
              </p>
            </div>
          ) : loading || transactionsLoading ? (
            <div className="px-5 py-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-secondary" />
              ))}
            </div>
          ) : transactionsError ? (
            <div className="px-5 pt-5 pb-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{transactionsError}</AlertDescription>
              </Alert>
            </div>
          ) : cycles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <p className="text-sm text-muted-foreground/50">No transactions found</p>
            </div>
          ) : (
            <Tabs value={selectedCycle} onValueChange={setSelectedCycle} className="flex-col gap-0">
              <div className="px-4 pt-4 pb-3 overflow-x-auto">
                <TabsList className="h-auto inline-flex">
                  {cycles.map(cycle => {
                    const isCurrent = cycle.key === currentCycleKey
                    return (
                      <TabsTrigger
                        key={cycle.key}
                        value={cycle.key}
                        className="flex-col items-start gap-0.5 px-3 py-2 h-auto"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                          {cycle.label}
                        </span>
                        <span className={`text-xs font-mono tabular-nums ${cycle.total < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {cycle.total < 0 ? '-' : ''}{formatCurrency(Math.abs(cycle.total), cycle.currency_code)}
                        </span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              {cycles.map(cycle => (
                <TabsContent key={cycle.key} value={cycle.key} className="mt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                          <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cycle.transactions.map((txn, idx) => (
                          <tr key={txn.id} className={`border-b border-border last:border-0 hover:bg-secondary/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-secondary/20'}`}>
                            <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                              {new Date(txn.date).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-5 py-3.5 text-foreground">{txn.description}</td>
                            <td className="px-5 py-3.5 text-muted-foreground">{txn.category ?? '—'}</td>
                            <td className={`px-5 py-3.5 text-right font-mono tabular-nums ${txn.transaction_type === 'DEBIT' ? 'text-destructive' : 'text-green-400'}`}>
                              {txn.transaction_type === 'DEBIT' ? '-' : '+'}{formatCurrency(txn.amount_in_account_currency ?? Math.abs(txn.amount), 'BRL')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
