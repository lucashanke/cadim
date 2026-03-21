import { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Activity, PlusCircle, DollarSign, AlertCircle, LogOut, BarChart3, Wallet, CalendarClock, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { INVESTMENT_TYPE_LABELS, INVESTMENT_TYPE_COLORS } from '@/constants/investments'
import * as api from '@/lib/api'
import { DebugPanel } from './DebugPanel'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

interface DashboardPageProps {
  items: { id: string; name: string }[]
  formatCurrency: (value: number, currency: string) => string
  onConnectBank: () => void
  onDisconnectAll: () => void
}

export function DashboardPage({
  items,
  formatCurrency,
  onConnectBank,
  onDisconnectAll,
}: DashboardPageProps) {
  const [data, setData] = useState<api.BffDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getDashboard()
      setData(res)
    } catch (err) {
      if (err instanceof api.UnauthorizedError) return
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const spendingTrendData = data?.spending_trend
    ? {
        data: data.spending_trend.data_points,
        current: data.spending_trend.data_points[data.spending_trend.data_points.length - 1],
        previous: data.spending_trend.data_points[data.spending_trend.data_points.length - 2],
        change: data.spending_trend.change_percentage,
      }
    : null

  const pieData = data?.allocation
    ? {
        entries: data.allocation.entries.map(e => ({ name: e.type_key, value: e.amount })),
        total: data.allocation.total,
      }
    : null

  const spendingChartConfig: ChartConfig = {
    total: { label: 'Spending', color: 'hsl(var(--primary))' },
  }

  const dataReady = !loading && data !== null

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
            <AlertDescription>
              {error}
              <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={fetchData}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {data?.errors.accounts && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sync Error</AlertTitle>
            <AlertDescription>
              {data.errors.accounts}
              <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={fetchData}>
                Retry Sync
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {data?.errors.investments && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Investments Sync Error</AlertTitle>
            <AlertDescription>
              {data.errors.investments}
              <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={fetchData}>
                Retry Sync
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!dataReady ? (
          <>
            {/* Skeleton Net Worth hero */}
            <Card
              className="overflow-hidden shimmer opacity-0 border-primary/20"
              style={{ animation: 'rise-in 0.5s ease-out 0s forwards' }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-6">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-9 w-9 rounded-xl" />
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-2">
                <Skeleton className="h-9 w-48 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
                <Skeleton className="h-2 w-full rounded-full mt-3" />
              </CardContent>
            </Card>

            {/* Skeleton KPI grid */}
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card
                  key={i}
                  className="overflow-hidden shimmer opacity-0"
                  style={{ animation: `rise-in 0.5s ease-out ${0.12 + i * 0.12}s forwards` }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    <Skeleton className="h-7 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Skeleton charts row */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card
                className="overflow-hidden shimmer opacity-0"
                style={{ animation: 'rise-in 0.5s ease-out 0.48s forwards' }}
              >
                <CardHeader className="px-5 pt-5 pb-3">
                  <Skeleton className="h-5 w-40 rounded" />
                  <Skeleton className="h-3 w-56 rounded mt-1" />
                </CardHeader>
                <CardContent className="px-5 pb-5 flex items-center justify-center">
                  <Skeleton className="h-[180px] w-[180px] rounded-full" />
                </CardContent>
              </Card>
              <Card
                className="overflow-hidden shimmer opacity-0"
                style={{ animation: 'rise-in 0.5s ease-out 0.6s forwards' }}
              >
                <CardHeader className="px-5 pt-5 pb-2">
                  <Skeleton className="h-5 w-36 rounded" />
                  <Skeleton className="h-3 w-52 rounded mt-1" />
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="h-[180px] flex items-end gap-[3%] px-4 pb-6 pt-4">
                    {[0.5, 0.7, 0.6, 0.8, 0.9, 0.75].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 origin-bottom rounded-t bg-muted"
                        style={{
                          height: `${h * 100}%`,
                          animation: `chart-grow 0.6s ease-out ${0.7 + i * 0.06}s both`,
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
        <>
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
              {formatCurrency(
                data?.net_worth.total ?? 0,
                data?.net_worth.currency_code ?? 'BRL'
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Accounts: {data?.accounts ? formatCurrency(data.accounts.total_balance, data.accounts.currency_code) : 'R$ 0,00'}
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Investments: {formatCurrency(data?.net_worth.investments_total ?? 0, data?.investments?.currency_code ?? 'BRL')}
              </span>
            </p>

            {/* Composition bar */}
            {data?.composition && (
              <div className="mt-4 space-y-2">
                <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                  {data.composition.segments.map((seg) => (
                    <div
                      key={seg.type_key}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${(seg.amount / data.composition!.total) * 100}%`,
                        backgroundColor: seg.color,
                        opacity: 0.85,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {data.composition.segments.map((seg) => (
                    <div key={seg.type_key} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: seg.color, opacity: 0.85 }} />
                      <span className="text-[10px] text-muted-foreground">
                        {seg.label} {seg.percentage.toFixed(0)}%
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
                {data?.accounts ? (
                  formatCurrency(data.accounts.total_balance, data.accounts.currency_code)
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
                {data?.investments ? (
                  formatCurrency(data.investments.total_gross_amount, data.investments.currency_code)
                ) : (
                  'R$ 0,00'
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Activity className="h-3 w-3 text-violet-400" />
                {items.length === 0
                  ? 'Connect an account to see investments'
                  : `${data?.investments?.investment_count ?? 0} position${(data?.investments?.investment_count ?? 0) !== 1 ? 's' : ''}`}
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
              {(data?.attention_items.length ?? 0) === 0 ? (
                <div className="flex items-center gap-2 py-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500/60" />
                  <p className="text-xs text-muted-foreground/60">All clear</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {data!.attention_items.slice(0, 4).map((item) => (
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
                  {data!.attention_items.length > 4 && (
                    <p className="text-[10px] text-muted-foreground/60">+{data!.attention_items.length - 4} more</p>
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
            {spendingTrendData ? (
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
        </>
        )}
      </div>

      <DebugPanel sections={[
        { label: 'dashboardData', data: data },
        { label: 'error', data: error },
      ]} />
    </>
  )
}
