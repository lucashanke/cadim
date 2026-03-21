import { useState, useEffect, useCallback, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, PlusCircle, BarChart3, Pencil, Trash2, ChevronUp, ChevronDown, Wallet, Banknote, TrendingUp, CalendarClock } from 'lucide-react'
import { colorBadgeStyle } from '@/lib/color'
import * as api from '@/lib/api'
import type { BffPosition, BffInvestmentsResponse } from '@/lib/api'
import type { ManualPosition } from '@/types'
import { DebugPanel } from './DebugPanel'

interface InvestmentsPageProps {
  formatCurrency: (value: number, currency: string) => string
  onAddPosition: () => void
  onEditPosition: (pos: ManualPosition) => void
  onRemovePosition: (id: string) => void
  refreshTrigger: number
}

export function InvestmentsPage({
  formatCurrency,
  onAddPosition,
  onEditPosition,
  onRemovePosition,
  refreshTrigger,
}: InvestmentsPageProps) {
  const [data, setData] = useState<BffInvestmentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getInvestments()
      setData(result)
      if (result.errors.positions) {
        setError(result.errors.positions)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshTrigger])

  const positions = data?.positions ?? []
  const kpis = data?.kpis
  const allocation = data?.allocation ?? []
  const maturityGroups = data?.maturity_groups ?? []

  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [pieHover, setPieHover] = useState<{ name: string; x: number; y: number } | null>(null)

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sortedPositions = useMemo(() => {
    if (!sortCol) return positions
    return [...positions].sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null
      if (sortCol === 'name') { aVal = a.name; bVal = b.name }
      else if (sortCol === 'type') { aVal = a.investment_type; bVal = b.investment_type }
      else if (sortCol === 'subtype') { aVal = a.subtype ?? ''; bVal = b.subtype ?? '' }
      else if (sortCol === 'amount') { aVal = a.amount; bVal = b.amount }
      else if (sortCol === 'due_date') { aVal = a.due_date ?? ''; bVal = b.due_date ?? '' }
      else if (sortCol === 'rate') { aVal = a.fixed_annual_rate ?? 0; bVal = b.fixed_annual_rate ?? 0 }
      if (aVal === null || bVal === null) return 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [positions, sortCol, sortDir])

  // Build subtype breakdown from allocation data (for pie tooltip)
  const subtypesByType: Record<string, Record<string, number>> = {}
  for (const entry of allocation) {
    if (entry.subtypes.length > 0) {
      subtypesByType[entry.type_key] = {}
      for (const sub of entry.subtypes) {
        subtypesByType[entry.type_key][sub.label] = sub.amount
      }
    }
  }

  if (!loading && positions.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
        <BarChart3 className="h-12 w-12 text-muted-foreground/25" />
        <p className="text-sm text-muted-foreground/60 max-w-[240px] leading-relaxed">
          Connect a bank account to see your investment positions
        </p>
        <Button size="sm" onClick={onAddPosition}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Add Position
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Investments</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your portfolio allocation and positions across connected institutions</p>
        </div>
        <Button size="sm" onClick={onAddPosition}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Add Position
        </Button>
      </div>

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

      {loading ? (
        <>
          {/* Skeleton KPI cards with staggered rise-in + shimmer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Card
                key={i}
                className="overflow-hidden shimmer opacity-0"
                style={{ animation: `rise-in 0.5s ease-out ${i * 0.12}s forwards` }}
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

          {/* Skeleton positions table */}
          <Card
            className="overflow-hidden shimmer opacity-0"
            style={{ animation: 'rise-in 0.5s ease-out 0.48s forwards' }}
          >
            <CardHeader className="px-5 pt-5 pb-3">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-3 w-64 rounded mt-1" />
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-10 w-full rounded opacity-0"
                  style={{ animation: `rise-in 0.4s ease-out ${0.6 + i * 0.08}s forwards` }}
                />
              ))}
            </CardContent>
          </Card>
        </>
      ) : kpis && positions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Portfolio</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                <Wallet className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold font-heading tracking-tight">{formatCurrency(kpis.total_portfolio, 'BRL')}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpis.position_count} position{kpis.position_count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fixed Income</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300">
                <Banknote className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold font-heading tracking-tight">{formatCurrency(kpis.fixed_income, 'BRL')}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpis.fixed_income_pct.toFixed(1)}% of portfolio</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variable Income</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold font-heading tracking-tight">{formatCurrency(kpis.variable_income, 'BRL')}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpis.variable_income_pct.toFixed(1)}% of portfolio</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manual Positions</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                <Pencil className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold font-heading tracking-tight">{formatCurrency(kpis.manual_total, 'BRL')}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpis.manual_count} manual position{kpis.manual_count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-6">
      {allocation.length > 0 && (() => {
        const pieData = allocation.map(a => ({ name: a.type_key, value: a.amount, color: a.color }))
        const total = pieData.reduce((s, d) => s + d.value, 0)
        return (
          <Card className="w-fit">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-base text-foreground">Allocation</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Portfolio breakdown by investment type
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-6">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div
                  className="w-[200px] h-[200px] shrink-0 relative"
                  onMouseMove={(e) => {
                    if (pieHover) setPieHover(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
                  }}
                  onMouseLeave={() => setPieHover(null)}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart tabIndex={-1}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={94}
                        paddingAngle={3}
                        cornerRadius={5}
                        strokeWidth={0}
                        dataKey="value"
                        onMouseOver={(_, idx) => setPieHover(prev => ({ name: pieData[idx].name, x: prev?.x ?? 0, y: prev?.y ?? 0 }))}
                        onMouseOut={() => setPieHover(null)}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.color}
                            opacity={0.85}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {pieHover && pieHover.x > 0 && (() => {
                    const alloc = allocation.find(a => a.type_key === pieHover.name)
                    if (!alloc) return null
                    const pct = total > 0 ? ((alloc.amount / total) * 100).toFixed(1) : '0'
                    return (
                      <div
                        className="fixed z-50 pointer-events-none rounded-lg border border-border bg-background px-3 py-2.5 shadow-xl text-xs min-w-[180px]"
                        style={{ left: pieHover.x + 12, top: pieHover.y - 12 }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: alloc.color }} />
                          <span className="font-semibold text-foreground">{alloc.label}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-medium tabular-nums">{formatCurrency(alloc.amount, 'BRL')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Share</span>
                          <span className="font-medium tabular-nums">{pct}%</span>
                        </div>
                        {alloc.subtypes.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-border space-y-1">
                            {alloc.subtypes.map((sub) => (
                              <div key={sub.subtype_key} className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">{sub.label}</span>
                                <span className="tabular-nums text-muted-foreground">{sub.percentage.toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
                <div className="flex flex-col gap-3 flex-1 w-full">
                  {allocation.map((a) => {
                    const pct = total > 0 ? ((a.amount / total) * 100) : 0
                    return (
                      <div key={a.type_key} className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: a.color, opacity: 0.85 }} />
                        <span className="text-xs text-muted-foreground flex-1">{a.label}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: a.color, opacity: 0.75 }} />
                          </div>
                          <span className="text-xs font-medium text-foreground tabular-nums w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {maturityGroups.length > 0 && (() => {
        const maxTotal = Math.max(...maturityGroups.map(g => g.total))
        const total = kpis?.total_portfolio ?? 0
        return (
          <Card className="flex-1 min-w-[320px]">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Maturity Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Portfolio breakdown by due date
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-6">
              <div className="flex flex-col gap-3">
                {maturityGroups.map((g) => {
                  const pct = total > 0 ? ((g.total / total) * 100) : 0
                  const barWidth = maxTotal > 0 ? (g.total / maxTotal) * 100 : 0
                  return (
                    <div key={g.label} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{g.label}</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {formatCurrency(g.total, 'BRL')}
                          <span className="text-muted-foreground ml-1.5">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      </div>

      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-base text-foreground">Positions</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            All investment positions across connected institutions
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {positions.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <BarChart3 className="h-10 w-10 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground/50">No investment positions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {(['name', 'type', 'subtype'] as const).map(col => (
                      <th key={col} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(col)}>
                          {col === 'name' ? 'Name' : col === 'type' ? 'Type' : 'Subtype'}
                          {sortCol === col ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                        </button>
                      </th>
                    ))}
                    {(['amount', 'due_date', 'rate'] as const).map(col => (
                      <th key={col} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="inline-flex items-center gap-1 ml-auto hover:text-foreground transition-colors" onClick={() => handleSort(col)}>
                          {sortCol === col ? (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                          {col === 'amount' ? 'Amount' : col === 'due_date' ? 'Due Date' : 'Rate'}
                        </button>
                      </th>
                    ))}
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((pos) => (
                    <tr
                      key={pos.id}
                      className="border-b border-border/40 last:border-0 hover:bg-secondary/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          {pos.name || '—'}
                          {pos.is_manual && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60 border border-primary/20 rounded px-1">Manual</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {pos.investment_type ? (
                          <span style={pos.type_color ? colorBadgeStyle(pos.type_color) : undefined}
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${!pos.type_color ? 'bg-secondary text-muted-foreground border-border' : ''}`}>
                            {pos.type_label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {pos.subtype ? (
                          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold tracking-wide text-muted-foreground">
                            {pos.subtype_label ?? pos.subtype}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right text-foreground font-mono">
                        {formatCurrency(pos.amount, pos.currency_code)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">
                        {pos.due_date ? new Date(pos.due_date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground font-mono text-xs">
                        {pos.rate_display}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {pos.is_manual && (
                          <span className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEditPosition(bffToManual(pos))}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onRemovePosition(pos.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <DebugPanel sections={[
        { label: 'positions', data: positions },
        { label: 'kpis', data: kpis },
        { label: 'allocation', data: allocation },
        { label: 'maturityGroups', data: maturityGroups },
      ]} />
    </div>
  )
}

function bffToManual(pos: BffPosition): ManualPosition {
  return {
    id: pos.id,
    investment_type: pos.investment_type,
    subtype: pos.subtype,
    amount: pos.amount,
    due_date: pos.due_date,
  }
}
