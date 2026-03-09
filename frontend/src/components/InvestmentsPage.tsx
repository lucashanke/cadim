import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, PlusCircle, BarChart3, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { INVESTMENT_TYPE_LABELS, INVESTMENT_TYPE_COLORS, SUBTYPE_LABELS } from '@/constants/investments'
import { colorBadgeStyle } from '@/lib/color'
import { formatRate } from '@/lib/investments'
import type { ConnectedItem, InvestmentPosition } from '@/types'

interface InvestmentsPageProps {
  items: ConnectedItem[]
  positions: InvestmentPosition[]
  loading: boolean
  error: string | null
  onRetry: () => void
  formatCurrency: (value: number, currency: string) => string
  manualPositionIds: Set<string>
  onAddPosition: () => void
  onEditPosition: (pos: InvestmentPosition) => void
  onRemovePosition: (id: string) => void
}

export function InvestmentsPage({
  items,
  positions,
  loading,
  error,
  onRetry,
  formatCurrency,
  manualPositionIds,
  onAddPosition,
  onEditPosition,
  onRemovePosition,
}: InvestmentsPageProps) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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

  const subtypesByType = positions.reduce((acc, p) => {
    if (!acc[p.investment_type]) acc[p.investment_type] = {}
    if (p.subtype) {
      acc[p.investment_type][p.subtype] = (acc[p.investment_type][p.subtype] ?? 0) + p.amount
    }
    return acc
  }, {} as Record<string, Record<string, number>>)

  if (items.length === 0 && positions.length === 0) {
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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Portfolio</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Investments</h1>
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
            <Button variant="outline" size="sm" className="ml-4 mt-2" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-6">
      {positions.length > 0 && (() => {
        const pieData = Object.entries(
          positions.reduce((acc, p) => {
            acc[p.investment_type] = (acc[p.investment_type] ?? 0) + p.amount
            return acc
          }, {} as Record<string, number>)
        )
          .map(([type, value]) => ({ name: type, value }))
          .sort((a, b) => b.value - a.value)
        const total = pieData.reduce((s, d) => s + d.value, 0)
        return (
          <Card className="w-fit">
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Allocation</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Portfolio breakdown by investment type
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-6">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="w-[200px] h-[200px] shrink-0">
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
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={INVESTMENT_TYPE_COLORS[entry.name] ?? INVESTMENT_TYPE_COLORS.OTHER}
                            opacity={0.85}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload
                          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
                          const label = INVESTMENT_TYPE_LABELS[d.name]?.label ?? d.name
                          const subtypes = Object.entries(subtypesByType[d.name] ?? {})
                            .sort((a, b) => b[1] - a[1])
                          return (
                            <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm px-3.5 py-2.5 text-xs shadow-2xl">
                              <p className="font-semibold text-foreground mb-1">{label}</p>
                              <p className="text-muted-foreground">{formatCurrency(d.value, 'BRL')}</p>
                              <p className="text-muted-foreground/70 tabular-nums">{pct}%</p>
                              {subtypes.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                                  {subtypes.map(([subtype, amount]) => {
                                    const subPct = d.value > 0 ? ((amount / d.value) * 100).toFixed(1) : '0'
                                    const subLabel = SUBTYPE_LABELS[subtype]?.label ?? subtype
                                    return (
                                      <div key={subtype} className="flex items-center justify-between gap-4">
                                        <span className="text-muted-foreground">{subLabel}</span>
                                        <span className="tabular-nums text-muted-foreground/70">{subPct}%</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3 flex-1 w-full">
                  {pieData.map((d) => {
                    const color = INVESTMENT_TYPE_COLORS[d.name] ?? INVESTMENT_TYPE_COLORS.OTHER
                    const label = INVESTMENT_TYPE_LABELS[d.name]?.label ?? d.name
                    const pct = total > 0 ? ((d.value / total) * 100) : 0
                    return (
                      <div key={d.name} className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color, opacity: 0.85 }} />
                        <span className="text-xs text-muted-foreground flex-1">{label}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.75 }} />
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

      </div>

      <Card>
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Positions</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            All investment positions across connected institutions
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-5 pb-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-secondary" />
              ))}
            </div>
          ) : positions.length === 0 ? (
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
                  {sortedPositions.map((pos, idx) => (
                    <tr
                      key={pos.id}
                      className={`border-b border-border last:border-0 hover:bg-secondary/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-secondary/20'}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        <span className="flex items-center gap-2">
                          {pos.name || '—'}
                          {manualPositionIds.has(pos.id) && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60 border border-primary/20 rounded px-1">Manual</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {pos.investment_type ? (() => {
                          const color = INVESTMENT_TYPE_COLORS[pos.investment_type]
                          const label = INVESTMENT_TYPE_LABELS[pos.investment_type]?.label ?? pos.investment_type
                          return (
                            <span style={color ? colorBadgeStyle(color) : undefined}
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${!color ? 'bg-secondary text-muted-foreground border-border' : ''}`}>
                              {label}
                            </span>
                          )
                        })() : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {pos.subtype ? (
                          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                            {SUBTYPE_LABELS[pos.subtype]?.label ?? pos.subtype}
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
                        {formatRate(pos)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {manualPositionIds.has(pos.id) && (
                          <span className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEditPosition(pos)}>
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
    </div>
  )
}
