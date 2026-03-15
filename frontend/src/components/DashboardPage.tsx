import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Activity, PlusCircle, DollarSign, AlertCircle, LogOut, BarChart3, Wallet, CalendarClock, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { INVESTMENT_TYPE_LABELS, INVESTMENT_TYPE_COLORS } from '@/constants/investments'
import type { AccountsSummary, ConnectedItem, HealthStatus, InvestmentsSummary, InvestmentPosition, CreditCardAccount, BillingCycle } from '@/types'
import { DebugPanel } from './DebugPanel'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

interface DashboardPageProps {
  health: HealthStatus | null
  loading: boolean
  accountsSummary: AccountsSummary | null
  accountsLoading: boolean
  accountsError: string | null
  investmentsSummary: InvestmentsSummary | null
  investmentsLoading: boolean
  investmentsError: string | null
  manualTotal: number
  error: string | null
  items: ConnectedItem[]
  formatCurrency: (value: number, currency: string) => string
  onConnectBank: () => void
  onDisconnectAll: () => void
  onRetryAccounts: () => void
  onRetryInvestments: () => void
  allPositions: InvestmentPosition[]
  creditCards: CreditCardAccount[]
  billingCycles: BillingCycle[]
  billingCyclesLoading: boolean
}

export function DashboardPage({
  health,
  loading,
  accountsSummary,
  accountsLoading,
  accountsError,
  investmentsSummary,
  investmentsLoading,
  investmentsError,
  manualTotal,
  error,
  items,
  formatCurrency,
  onConnectBank,
  onDisconnectAll,
  onRetryAccounts,
  onRetryInvestments,
  allPositions,
  creditCards,
  billingCycles,
  billingCyclesLoading,
}: DashboardPageProps) {
  // ── Net Worth composition bar data ────────────────────────────────────
  const compositionData = useMemo(() => {
    const accountsTotal = accountsSummary?.total_balance ?? 0
    const investmentsTotal = (investmentsSummary?.total_gross_amount ?? 0) + manualTotal
    const total = accountsTotal + investmentsTotal
    if (total <= 0) return null

    const typeGroups: { type: string; amount: number; color: string }[] = []

    if (accountsTotal > 0) {
      typeGroups.push({ type: 'Accounts', amount: accountsTotal, color: 'hsl(var(--primary))' })
    }

    const grouped = allPositions.reduce((acc, p) => {
      acc[p.investment_type] = (acc[p.investment_type] ?? 0) + p.amount
      return acc
    }, {} as Record<string, number>)

    Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, amount]) => {
        typeGroups.push({
          type: INVESTMENT_TYPE_LABELS[type]?.label ?? type,
          amount,
          color: INVESTMENT_TYPE_COLORS[type] ?? INVESTMENT_TYPE_COLORS.OTHER,
        })
      })

    return { total, segments: typeGroups }
  }, [accountsSummary, investmentsSummary, manualTotal, allPositions])

  // ── Portfolio allocation pie data ─────────────────────────────────────
  const pieData = useMemo(() => {
    if (allPositions.length === 0) return null
    const grouped = allPositions.reduce((acc, p) => {
      acc[p.investment_type] = (acc[p.investment_type] ?? 0) + p.amount
      return acc
    }, {} as Record<string, number>)
    const entries = Object.entries(grouped)
      .map(([type, value]) => ({ name: type, value }))
      .sort((a, b) => b.value - a.value)
    const total = entries.reduce((s, d) => s + d.value, 0)
    return { entries, total }
  }, [allPositions])

  // ── Attention items ───────────────────────────────────────────────────
  const attentionItems = useMemo(() => {
    const items: { id: string; label: string; amount: number; urgency: 'amber' | 'red'; detail: string }[] = []
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const in90Days = new Date(now)
    in90Days.setDate(in90Days.getDate() + 60)

    // Maturing positions
    for (const pos of allPositions) {
      if (!pos.due_date) continue
      const due = new Date(pos.due_date)
      due.setHours(0, 0, 0, 0)
      if (due <= in90Days) {
        const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        items.push({
          id: pos.id,
          label: pos.name,
          amount: pos.amount,
          urgency: daysLeft <= 0 ? 'red' : 'amber',
          detail: daysLeft <= 0 ? 'Matured' : `${daysLeft}d to maturity`,
        })
      }
    }

    // Sort: red first, then by urgency detail
    items.sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency === 'red' ? -1 : 1
      return 0
    })

    return items.slice(0, 5)
  }, [allPositions])

  // ── Spending trend data ───────────────────────────────────────────────
  const spendingTrendData = useMemo(() => {
    if (billingCycles.length < 2) return null
    const sorted = [...billingCycles].sort((a, b) => a.key.localeCompare(b.key))
    const data = sorted.map(c => ({
      label: c.label,
      total: Math.abs(c.total),
    }))
    const current = data[data.length - 1]
    const previous = data[data.length - 2]
    const change = previous.total > 0
      ? ((current.total - previous.total) / previous.total) * 100
      : null
    return { data, current, previous, change }
  }, [billingCycles])

  const spendingChartConfig: ChartConfig = {
    total: { label: 'Spending', color: 'hsl(var(--primary))' },
  }

  const dataLoading = accountsLoading || investmentsLoading

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {getGreeting()}, Lucas
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={onConnectBank} size="sm" className="h-8 gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Connect Bank
          </Button>
          {items.length > 0 && (
            <Button variant="destructive" onClick={onDisconnectAll} size="sm" className="h-8 gap-1.5">
              <LogOut className="h-4 w-4" />
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
              <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={onRetryAccounts}>
                Retry Sync
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {investmentsError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Investments Sync Error</AlertTitle>
            <AlertDescription>
              {investmentsError}
              <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={onRetryInvestments}>
                Retry Sync
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ── Section 2: Net Worth Hero Card with Composition Bar ─────── */}
        <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Worth</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="text-3xl font-bold font-heading tracking-tight text-gradient">
              {dataLoading ? (
                <Skeleton className="h-9 w-48 bg-secondary" />
              ) : (
                formatCurrency(
                  (accountsSummary?.total_balance ?? 0) + (investmentsSummary?.total_gross_amount ?? 0) + manualTotal,
                  accountsSummary?.currency_code ?? investmentsSummary?.currency_code ?? 'BRL'
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Accounts: {accountsSummary ? formatCurrency(accountsSummary.total_balance, accountsSummary.currency_code) : 'R$ 0,00'}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Investments: {formatCurrency((investmentsSummary?.total_gross_amount ?? 0) + manualTotal, investmentsSummary?.currency_code ?? 'BRL')}
              </span>
            </p>

            {/* Composition bar */}
            {!dataLoading && compositionData && (
              <div className="mt-4 space-y-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                  {compositionData.segments.map((seg) => (
                    <div
                      key={seg.type}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${(seg.amount / compositionData.total) * 100}%`,
                        backgroundColor: seg.color,
                        opacity: 0.85,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {compositionData.segments.map((seg) => (
                    <div key={seg.type} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: seg.color, opacity: 0.85 }} />
                      <span className="text-[10px] text-muted-foreground">
                        {seg.type} {((seg.amount / compositionData.total) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── KPI Grid + Attention Items ── */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Balance</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold font-heading tracking-tight text-gradient">
                {accountsLoading ? (
                  <Skeleton className="h-8 w-32 bg-secondary" />
                ) : accountsSummary ? (
                  formatCurrency(accountsSummary.total_balance, accountsSummary.currency_code)
                ) : (
                  'R$ 0,00'
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Activity className="h-3 w-3 text-green-500" />
                {items.length === 0 ? "Connect an account to see balance" : "Refreshed just now"}
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investments</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300">
                <BarChart3 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold font-heading tracking-tight text-gradient">
                {investmentsLoading ? (
                  <Skeleton className="h-8 w-32 bg-secondary" />
                ) : (investmentsSummary || manualTotal > 0) ? (
                  formatCurrency((investmentsSummary?.total_gross_amount ?? 0) + manualTotal, investmentsSummary?.currency_code ?? 'BRL')
                ) : (
                  'R$ 0,00'
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Activity className="h-3 w-3 text-violet-400" />
                {items.length === 0
                  ? 'Connect an account to see investments'
                  : `${investmentsSummary?.investment_count ?? 0} position${(investmentsSummary?.investment_count ?? 0) !== 1 ? 's' : ''}`}
              </p>
            </CardContent>
          </Card>

          {/* Needs Attention */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs Attention</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <CalendarClock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {attentionItems.length === 0 ? (
                <div className="flex items-center gap-2 py-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500/60" />
                  <p className="text-xs text-muted-foreground/60">All clear</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {attentionItems.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded border-l-2 pl-2 ${
                        item.urgency === 'red' ? 'border-l-red-500' : 'border-l-amber-500'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{item.label}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] shrink-0 px-1 py-0 ${
                          item.urgency === 'red'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {item.detail}
                      </Badge>
                    </div>
                  ))}
                  {attentionItems.length > 4 && (
                    <p className="text-[10px] text-muted-foreground/60">+{attentionItems.length - 4} more</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Charts Row: Portfolio Allocation + Spending Trend ─────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Portfolio Allocation Mini Ring */}
          {pieData && (
            <Card>
              <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">Portfolio Allocation</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Investment distribution by type
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-center justify-center gap-8">
                  <div className="w-[180px] h-[180px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart tabIndex={-1}>
                        <Pie
                          data={pieData.entries}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          cornerRadius={4}
                          strokeWidth={0}
                          dataKey="value"
                        >
                          {pieData.entries.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={INVESTMENT_TYPE_COLORS[entry.name] ?? INVESTMENT_TYPE_COLORS.OTHER}
                              opacity={0.85}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                    {pieData.entries.slice(0, 5).map((d) => {
                      const color = INVESTMENT_TYPE_COLORS[d.name] ?? INVESTMENT_TYPE_COLORS.OTHER
                      const label = INVESTMENT_TYPE_LABELS[d.name]?.label ?? d.name
                      const pct = pieData.total > 0 ? ((d.value / pieData.total) * 100) : 0
                      return (
                        <div key={d.name} className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color, opacity: 0.85 }} />
                          <span className="text-xs text-muted-foreground truncate flex-1">{label}</span>
                          <span className="text-xs font-medium text-foreground tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                    {pieData.entries.length > 5 && (
                      <span className="text-[10px] text-muted-foreground/60 pl-5">+{pieData.entries.length - 5} more</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spending Trend Chart */}
          <Card>
          <CardHeader className="px-5 pt-5 pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Spending Trend</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Total spending across billing cycles
                </CardDescription>
              </div>
              {spendingTrendData && spendingTrendData.change !== null && (
                <Badge
                  variant="secondary"
                  className={`text-[10px] font-semibold shrink-0 ${
                    spendingTrendData.change <= 0
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  {spendingTrendData.change <= 0 ? (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(spendingTrendData.change).toFixed(1)}%
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {billingCyclesLoading ? (
              <Skeleton className="h-[180px] w-full bg-secondary" />
            ) : spendingTrendData ? (
              <div className="space-y-3">
                <ChartContainer config={spendingChartConfig} className="h-[180px] w-full aspect-auto">
                  <AreaChart data={spendingTrendData.data} margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v, 'BRL')}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      width={100}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-xl text-xs">
                            <p className="font-semibold text-foreground mb-1">{d.label}</p>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Total</span>
                              <span className="font-medium tabular-nums">{formatCurrency(d.total, 'BRL')}</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="var(--color-total)"
                      strokeWidth={2}
                      fill="var(--color-total)"
                      fillOpacity={0.15}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                    />
                  </AreaChart>
                </ChartContainer>
                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground">Current: </span>
                    <span className="font-medium tabular-nums">{formatCurrency(spendingTrendData.current.total, 'BRL')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Previous: </span>
                    <span className="font-medium tabular-nums">{formatCurrency(spendingTrendData.previous.total, 'BRL')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center min-h-[180px] rounded-lg bg-secondary/50 border border-dashed border-border">
                <div className="text-center space-y-2">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/25 mx-auto" />
                  <p className="text-sm text-muted-foreground/50 max-w-[200px] leading-relaxed">
                    No spending data yet — connect a credit card to track trends
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      <DebugPanel sections={[
        { label: 'accountsSummary', data: accountsSummary },
        { label: 'investmentsSummary', data: investmentsSummary },
        { label: 'manualTotal', data: manualTotal },
        { label: 'net worth calculation', data: {
          accounts: accountsSummary?.total_balance ?? 0,
          investments: investmentsSummary?.total_gross_amount ?? 0,
          manual: manualTotal,
          total: (accountsSummary?.total_balance ?? 0) + (investmentsSummary?.total_gross_amount ?? 0) + manualTotal,
        }},
        { label: 'creditCards', data: creditCards },
        { label: 'allPositions', data: allPositions },
        { label: 'billingCycles', data: billingCycles },
        { label: 'attentionItems', data: attentionItems },
        { label: 'health', data: health },
        { label: 'items', data: items },
      ]} />
    </>
  )
}
