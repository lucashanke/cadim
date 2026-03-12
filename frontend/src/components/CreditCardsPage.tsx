import * as React from 'react'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Cell, AreaChart, Area, CartesianGrid } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertCircle, AlertTriangle, ArrowLeftRight, Award, Baby, Banknote, BedDouble,
  Bike, BookOpen, Briefcase, Car, Clapperboard, Cpu, CreditCard, Dices, Dumbbell,
  Eye, Fuel, Gamepad2, GraduationCap, Globe, HandHeart, HeartPulse, Home,
  Hospital, Percent, PawPrint, Pill, Plane, Phone, Popcorn, Receipt, Search, ShoppingBag,
  ShoppingBasket, ShoppingCart, Shirt, Smile, Sofa, SquareParking, Stethoscope,
  Tag, Ticket, TrendingDown, TrendingUp, Utensils, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ConnectedItem, CreditCardAccount, TransactionItem, TransactionsResponse } from '@/types'
import { getCycleKey, groupByCycle, type BillingCycle } from '@/lib/billing-cycles'

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Food & dining
  'Eating out': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-l-orange-500/50' },
  'Food delivery': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-l-amber-500/50' },
  'Groceries': { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-l-lime-500/50' },
  // Shopping
  'Shopping': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-l-pink-500/50' },
  'Online shopping': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-l-pink-500/50' },
  'Clothing': { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-l-pink-500/50' },
  'Houseware': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-l-rose-500/50' },
  'Electronics': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-l-blue-500/50' },
  'Sports goods': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-l-emerald-500/50' },
  'Kids and toys': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-l-rose-500/50' },
  'Office supplies': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-l-indigo-500/50' },
  'Bookstore': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-l-indigo-500/50' },
  // Transport & travel
  'Taxi and ride-hailing': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-l-sky-500/50' },
  'Parking': { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-l-sky-500/50' },
  'Gas stations': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-l-amber-500/50' },
  'Airport and airlines': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-l-cyan-500/50' },
  'Accomodation': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-l-cyan-500/50' },
  'Mileage programs': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-l-cyan-500/50' },
  // Health
  'Healthcare': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  'Dentist': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  'Hospital clinics and labs': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  'Optometry': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  'Pharmacy': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  'Pet supplies and vet': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-l-green-500/50' },
  // Entertainment & leisure
  'Entertainment': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-l-violet-500/50' },
  'Cinema, theater and concerts': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-l-violet-500/50' },
  'Gaming': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-l-violet-500/50' },
  'Leisure': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-l-violet-500/50' },
  'Tickets': { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-l-violet-500/50' },
  'Gambling': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  // Digital & services
  'Digital services': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-l-purple-500/50' },
  'Telecommunications': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-l-blue-500/50' },
  'Services': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500/50' },
  // Housing & utilities
  'Housing': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-l-purple-500/50' },
  'Utilities': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-l-yellow-500/50' },
  // Education
  'Education': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-l-indigo-500/50' },
  'School': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-l-indigo-500/50' },
  // Donations
  'Donations': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-l-emerald-500/50' },
  // Finance / fees / transfers (neutral)
  'Credit card fees': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500/50' },
  'Credit card payment': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500/50' },
  'Transfers': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500/50' },
  'Bank fees': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500/50' },
  'Tax on financial operations': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-l-slate-500/50' },
  'Interests charged': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  'Late payment and overdraft costs': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-l-red-500/50' },
  'Automatic investment': { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-l-teal-500/50' },
}
const DEFAULT_CATEGORY = { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-l-zinc-500/50' }
function getCategoryColors(cat: string | null) { return cat ? (CATEGORY_COLORS[cat] ?? DEFAULT_CATEGORY) : DEFAULT_CATEGORY }

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Food & dining
  'Eating out': Utensils,
  'Food delivery': Bike,
  'Groceries': ShoppingBasket,
  // Shopping
  'Shopping': ShoppingBag,
  'Online shopping': ShoppingCart,
  'Clothing': Shirt,
  'Houseware': Sofa,
  'Electronics': Cpu,
  'Sports goods': Dumbbell,
  'Kids and toys': Baby,
  'Office supplies': Briefcase,
  'Bookstore': BookOpen,
  // Transport & travel
  'Taxi and ride-hailing': Car,
  'Parking': SquareParking,
  'Gas stations': Fuel,
  'Airport and airlines': Plane,
  'Accomodation': BedDouble,
  'Mileage programs': Award,
  // Health
  'Healthcare': HeartPulse,
  'Dentist': Stethoscope,
  'Hospital clinics and labs': Hospital,
  'Optometry': Eye,
  'Pharmacy': Pill,
  'Pet supplies and vet': PawPrint,
  // Entertainment & leisure
  'Entertainment': Popcorn,
  'Cinema, theater and concerts': Clapperboard,
  'Gaming': Gamepad2,
  'Leisure': Smile,
  'Tickets': Ticket,
  'Gambling': Dices,
  // Digital & services
  'Digital services': Globe,
  'Telecommunications': Phone,
  'Services': Wrench,
  // Housing & utilities
  'Housing': Home,
  'Utilities': Zap,
  // Education
  'Education': GraduationCap,
  'School': GraduationCap,
  // Donations
  'Donations': HandHeart,
  // Finance
  'Credit card fees': CreditCard,
  'Credit card payment': CreditCard,
  'Transfers': ArrowLeftRight,
  'Bank fees': Banknote,
  'Tax on financial operations': Percent,
  'Interests charged': TrendingDown,
  'Late payment and overdraft costs': AlertTriangle,
  'Automatic investment': TrendingUp,
}
function getCategoryIcon(cat: string | null): LucideIcon | null {
  return cat ? (CATEGORY_ICONS[cat] ?? null) : null
}

function getCategoryChartColor(cat: string): string {
  const colorMap: Record<string, string> = {
    orange: '#f97316', amber: '#f59e0b', lime: '#84cc16',
    pink: '#ec4899', rose: '#f43f5e', blue: '#3b82f6',
    emerald: '#10b981', indigo: '#6366f1', sky: '#0ea5e9',
    cyan: '#06b6d4', red: '#ef4444', green: '#22c55e',
    violet: '#8b5cf6', purple: '#a855f7', slate: '#64748b',
    yellow: '#eab308', teal: '#14b2a6',
  }
  const textClass = (CATEGORY_COLORS[cat] ?? DEFAULT_CATEGORY).text
  const match = textClass.match(/text-(\w+)-/)
  if (match) return colorMap[match[1]] ?? '#64748b'
  return '#64748b'
}

function getCycleSummary(cycle: BillingCycle) {
  const counted = cycle.transactions.filter(
    t => t.category !== 'Credit card payment' && t.category !== 'Transfers'
  )
  const byCategory = counted.reduce<Record<string, number>>((acc, t) => {
    const cat = t.category ?? 'Unknown'
    acc[cat] = (acc[cat] ?? 0) + Math.abs(t.amount_in_account_currency ?? t.amount)
    return acc
  }, {})
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { txnCount: counted.length, topCategory }
}

interface CategoryBreakdown {
  category: string
  amount: number
  percentage: number
  color: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpendingHistoryChart({
  cycles,
  formatCurrency,
}: {
  cycles: BillingCycle[]
  formatCurrency: (value: number, currency: string) => string
}) {
  const recentCycles = cycles.slice(-6)
  if (recentCycles.length < 2) return null

  const categoryTotals: Record<string, number> = {}
  for (const cycle of recentCycles) {
    for (const txn of cycle.transactions) {
      if (txn.category === 'Credit card payment' || txn.category === 'Transfers') continue
      const cat = txn.category ?? 'Other'
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Math.abs(txn.amount_in_account_currency ?? txn.amount)
    }
  }
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cat]) => cat)

  const data = recentCycles.map(cycle => {
    const point: Record<string, number | string> = { cycle: cycle.label }
    for (const cat of topCategories) point[cat] = 0
    for (const txn of cycle.transactions) {
      if (txn.category === 'Credit card payment' || txn.category === 'Transfers') continue
      const cat = txn.category ?? 'Other'
      if (topCategories.includes(cat)) {
        ;(point[cat] as number) += Math.abs(txn.amount_in_account_currency ?? txn.amount)
      }
    }
    return point
  })

  const chartConfig: ChartConfig = Object.fromEntries(
    topCategories.map(cat => [cat, { label: cat, color: getCategoryChartColor(cat) }])
  )
  const currencyCode = recentCycles[0].currency_code
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  // Custom tooltip: clean layout, skip zero-value entries
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    const entries = [...payload].reverse().filter(e => e.value > 0)
    return (
      <div className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-xl text-xs min-w-[180px]">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        <div className="space-y-1.5">
          {entries.map(e => (
            <div key={e.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-muted-foreground">{e.name}</span>
              </div>
              <span className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(e.value, currencyCode)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Dialog>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <TrendingUp className="h-3.5 w-3.5" />
          Spending history
        </Button>
      } />
      <DialogContent className="sm:max-w-[80vw]">
        <DialogHeader>
          <DialogTitle>Spending by Category — Past 6 Months</DialogTitle>
        </DialogHeader>
        <ChartContainer config={chartConfig} className="h-[420px] w-full aspect-auto mt-2">
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
            <defs>
              {topCategories.map(cat => (
                <linearGradient key={cat} id={`grad-${cat.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={getCategoryChartColor(cat)} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={getCategoryChartColor(cat)} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis
              dataKey="cycle"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tickFormatter={v => formatCurrency(v, currencyCode)}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <ChartTooltip content={<CustomTooltip />} />
            {topCategories.map(cat => {
              const dimmed = selectedCat !== null && selectedCat !== cat
              return (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  stackId={selectedCat === null ? '1' : cat}
                  stroke={getCategoryChartColor(cat)}
                  strokeWidth={dimmed ? 0 : 1.5}
                  strokeOpacity={dimmed ? 0 : 1}
                  fillOpacity={dimmed ? 0 : 1}
                  fill={`url(#grad-${cat.replace(/\s+/g, '-')})`}
                  dot={false}
                  activeDot={dimmed ? false : { r: 4, strokeWidth: 0 }}
                  style={{ transition: 'opacity 0.2s' }}
                />
              )
            })}
          </AreaChart>
        </ChartContainer>

        <div className="grid grid-cols-4 gap-x-6 gap-y-2 mt-1">
          {topCategories.map(cat => {
            const isSelected = selectedCat === cat
            const isDimmed = selectedCat !== null && !isSelected
            return (
              <button
                key={cat}
                onClick={() => setSelectedCat(isSelected ? null : cat)}
                className={`flex items-center gap-2 min-w-0 text-left transition-opacity ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-sm shrink-0 transition-all"
                  style={{ backgroundColor: getCategoryChartColor(cat), outline: isSelected ? `2px solid ${getCategoryChartColor(cat)}` : 'none', outlineOffset: '2px' }}
                />
                <span className={`text-xs truncate transition-colors ${isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{cat}</span>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CycleSummaryBar({
  activeCycle,
  selectedCard,
  formatCurrency,
}: {
  activeCycle: BillingCycle
  selectedCard: string | null
  formatCurrency: (value: number, currency: string) => string
}) {
  const filteredTransactions = selectedCard
    ? activeCycle.transactions.filter(t => t.card_last_four === selectedCard)
    : activeCycle.transactions
  const { txnCount, topCategory } = getCycleSummary({ ...activeCycle, transactions: filteredTransactions })
  const filteredTotal = filteredTransactions.reduce((sum, t) => sum + (t.amount_in_account_currency ?? t.amount), 0)
  const displayTotal = selectedCard ? filteredTotal : activeCycle.total
  return (
    <div className="mx-4 mt-4 mb-3 flex items-center gap-6 rounded-xl border border-border bg-secondary/40 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Total Spent</p>
        <p className="text-2xl font-bold tracking-tight">
          {displayTotal < 0 ? '-' : ''}{formatCurrency(Math.abs(displayTotal), activeCycle.currency_code)}
        </p>
      </div>
      <div className="h-8 w-px bg-border shrink-0" />
      <div className="shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Transactions</p>
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Receipt className="h-3.5 w-3.5 text-primary" />
          {txnCount}
        </p>
      </div>
      {topCategory && (
        <>
          <div className="h-8 w-px bg-border shrink-0" />
          <div className="shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Top Category</p>
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <Tag className="h-3.5 w-3.5 text-primary" />
              {topCategory}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function TransactionTableView({
  transactions,
  searchQuery,
  onSearchChange,
  formatCurrency,
  currencyCode,
}: {
  transactions: TransactionItem[]
  searchQuery: string
  onSearchChange: (q: string) => void
  formatCurrency: (value: number, currency: string) => string
  currencyCode: string
}) {
  const filtered = searchQuery
    ? transactions.filter(t => t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : transactions

  const groups: { date: string; txns: TransactionItem[] }[] = []
  for (const txn of filtered) {
    const date = txn.date.split('T')[0]
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.txns.push(txn)
    } else {
      groups.push({ date, txns: [txn] })
    }
  }

  return (
    <div>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm bg-secondary/40 border-border/50"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-64" />
            <col className="w-24" />
            <col className="w-56" />
            <col className="w-36" />
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Card</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground/50">
                  No transactions found
                </td>
              </tr>
            ) : groups.map(({ date, txns }) => (
              <React.Fragment key={`group-${date}`}>
                <tr>
                  <td colSpan={4} className="px-5 pt-4 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </td>
                </tr>
                {txns.map((txn, idx) => (
                  <tr
                    key={txn.id}
                    className={`border-b border-border last:border-0 hover:bg-secondary/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-secondary/20'}`}
                  >
                    <td className="px-5 py-4 text-foreground font-medium truncate max-w-0">{txn.description}</td>
                    <td className="px-5 py-4 text-muted-foreground font-mono text-sm">
                      {txn.card_last_four ? `•••• ${txn.card_last_four}` : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      {txn.category ? (() => {
                        const Icon = getCategoryIcon(txn.category)
                        return (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium bg-secondary text-foreground/60">
                            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                            {txn.category}
                          </span>
                        )
                      })() : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className={`px-5 py-4 text-right font-mono tabular-nums ${txn.transaction_type === 'DEBIT' ? 'text-destructive' : 'text-green-400'}`}>
                      {txn.transaction_type === 'DEBIT' ? '-' : '+'}{formatCurrency(txn.amount_in_account_currency ?? Math.abs(txn.amount), currencyCode)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoryBreakdownView({
  transactions,
  formatCurrency,
  currencyCode,
}: {
  transactions: TransactionItem[]
  formatCurrency: (value: number, currency: string) => string
  currencyCode: string
}) {
  const counted = transactions.filter(
    t => t.category !== 'Credit card payment' && t.category !== 'Transfers'
  )
  const byCategory = counted.reduce<Record<string, number>>((acc, t) => {
    const cat = t.category ?? 'Unknown'
    acc[cat] = (acc[cat] ?? 0) + Math.abs(t.amount_in_account_currency ?? t.amount)
    return acc
  }, {})
  const totalAmount = Object.values(byCategory).reduce((sum, v) => sum + v, 0)
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const top8 = sorted.slice(0, 8)
  const others = sorted.slice(8)
  const otherTotal = others.reduce((sum, [, v]) => sum + v, 0)

  const breakdowns: CategoryBreakdown[] = [
    ...top8.map(([category, amount]) => ({
      category,
      amount,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      color: getCategoryChartColor(category),
    })),
    ...(otherTotal > 0 ? [{
      category: 'Other',
      amount: otherTotal,
      percentage: totalAmount > 0 ? (otherTotal / totalAmount) * 100 : 0,
      color: '#64748b',
    }] : []),
  ]

  if (breakdowns.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-muted-foreground/50">No spending data</p>
      </div>
    )
  }

  const chartConfig: ChartConfig = { amount: { label: 'Amount' } }

  return (
    <div className="px-4 py-4 flex gap-6">
      <div className="flex-1 min-w-0">
        <ChartContainer config={chartConfig} className="w-full aspect-auto" style={{ height: `${Math.max(breakdowns.length * 36, 120)}px` }}>
          <BarChart
            layout="vertical"
            data={breakdowns}
            margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category"
              width={140}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => [formatCurrency(Number(value), currencyCode), 'Amount']}
                  hideLabel
                />
              }
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {breakdowns.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>

      <div className="w-56 shrink-0 space-y-2.5 py-1">
        {breakdowns.map((item, idx) => {
          const Icon = getCategoryIcon(item.category)
          const colors = getCategoryColors(item.category)
          return (
            <div key={item.category} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-4 tabular-nums text-right">{idx + 1}</span>
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
                {Icon
                  ? <Icon className={`h-3 w-3 ${colors.text}`} />
                  : <Tag className={`h-3 w-3 ${colors.text}`} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium truncate">{item.category}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0">{formatCurrency(item.amount, currencyCode)}</span>
                </div>
                <div className="mt-0.5 h-0.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

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
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'transactions' | 'breakdown'>('transactions')
  const [searchQuery, setSearchQuery] = useState('')
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
    d.setMonth(d.getMonth() + 1)
    d.setDate(0) // last day of current month
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

  useEffect(() => {
    setSelectedCard(null)
    setActiveView('transactions')
    setSearchQuery('')
  }, [selectedCycle])

  const maxCycleTotal = cycles.reduce((max, c) => Math.max(max, Math.abs(c.total)), 0)

  const CARD_GRADIENTS = [
    'from-indigo-950 via-indigo-900 to-violet-900',
    'from-slate-900 via-zinc-800 to-slate-900',
    'from-emerald-950 via-teal-900 to-emerald-900',
    'from-rose-950 via-pink-900 to-rose-900',
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Cards</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Credit Cards</h1>
        </div>
        <div className="flex items-center gap-3">
          {!transactionsLoading && cycles.length >= 2 && (
            <SpendingHistoryChart cycles={cycles} formatCurrency={formatCurrency} />
          )}
          {creditCards.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{creditCards.length}</span>
              <span className="text-xs text-muted-foreground">card{creditCards.length !== 1 ? 's' : ''} connected</span>
            </div>
          )}
        </div>
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
            <Tabs value={selectedCycle} onValueChange={setSelectedCycle} className="flex gap-0">
              {/* Left sidebar — billing cycles */}
              <div className="w-44 shrink-0 border-r border-border overflow-y-auto" style={{ maxHeight: '600px' }}>
                <TabsList className="flex flex-col h-auto w-full bg-transparent p-2 gap-0.5">
                  {cycles.map(cycle => {
                    const isCurrent = cycle.key === currentCycleKey
                    return (
                      <TabsTrigger
                        key={cycle.key}
                        value={cycle.key}
                        className="w-full flex-col items-start gap-0.5 px-3 py-2.5 h-auto rounded-lg
                          data-[state=active]:bg-secondary data-[state=active]:shadow-none
                          hover:bg-secondary/50 transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold w-full">
                          {isCurrent && (
                            <span className="relative h-2 w-2 shrink-0">
                              <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
                              <span className="relative block h-2 w-2 rounded-full bg-primary" />
                            </span>
                          )}
                          {cycle.label}
                        </span>
                        <span className="mt-1 block h-0.5 w-full rounded-full bg-muted overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-primary/70 transition-all duration-500"
                            style={{ width: maxCycleTotal > 0 ? `${(Math.abs(cycle.total) / maxCycleTotal) * 100}%` : '0%' }}
                          />
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {cycle.total !== 0 ? formatCurrency(Math.abs(cycle.total), cycle.currency_code) : '—'}
                        </span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>

              {/* Right content */}
              <div className="flex-1 min-w-0 flex flex-col">
                {cycles.map(cycle => {
                  const activeCycle = cycles.find(c => c.key === cycle.key)!
                  const cards = [...new Set(activeCycle.transactions.map(t => t.card_last_four).filter(Boolean))] as string[]
                  const filteredTransactions = selectedCard
                    ? activeCycle.transactions.filter(t => t.card_last_four === selectedCard)
                    : activeCycle.transactions

                  return (
                    <TabsContent key={cycle.key} value={cycle.key} className="mt-0 flex flex-col">

                      {/* Summary bar */}
                      <CycleSummaryBar
                        activeCycle={activeCycle}
                        selectedCard={selectedCard}
                        formatCurrency={formatCurrency}
                      />

                      {/* Card filter */}
                      {cards.length > 1 && (
                        <div className="mx-4 mb-3 flex items-center gap-3 flex-wrap">
                          {/* ALL button */}
                          <button
                            onClick={() => setSelectedCard(null)}
                            className={`group relative h-[68px] w-[88px] rounded-xl border transition-all duration-200 overflow-hidden
                              ${selectedCard === null
                                ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_4px_20px_hsl(var(--primary)/0.15)]'
                                : 'border-border/50 hover:border-border'
                              }`}
                          >
                            <div className={`absolute inset-0 bg-gradient-to-br transition-opacity duration-200
                              ${selectedCard === null ? 'from-primary/20 via-primary/10 to-transparent opacity-100' : 'from-secondary/80 via-secondary/40 to-transparent opacity-60 group-hover:opacity-90'}`}
                            />
                            <div className="relative h-full flex flex-col justify-between p-2.5">
                              <div className="flex items-center justify-between">
                                <div className={`flex gap-[3px] transition-opacity ${selectedCard === null ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'}`}>
                                  {[0, 1, 2].map(i => <span key={i} className="block h-1.5 w-1.5 rounded-full bg-current opacity-50" />)}
                                </div>
                                {selectedCard === null && (
                                  <span className="block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                                )}
                              </div>
                              <div className="text-left">
                                <p className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${selectedCard === null ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/70'}`}>
                                  All
                                </p>
                                <p className={`text-[9px] tracking-wide transition-colors ${selectedCard === null ? 'text-primary/80' : 'text-muted-foreground/50'}`}>
                                  {cards.length} cards
                                </p>
                                <p className={`text-[9px] tabular-nums font-semibold mt-0.5 ${selectedCard === null ? 'text-foreground/70' : 'text-muted-foreground/40'}`}>
                                  {formatCurrency(Math.abs(activeCycle.total), activeCycle.currency_code)}
                                </p>
                              </div>
                            </div>
                          </button>

                          {/* Per-card buttons */}
                          {cards.map((last4, i) => {
                            const isActive = selectedCard === last4
                            const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length]
                            const cardTotal = activeCycle.transactions
                              .filter(t => t.card_last_four === last4)
                              .reduce((sum, t) => {
                                if (t.category === 'Credit card payment' || t.category === 'Transfers') return sum
                                return sum + (t.amount_in_account_currency != null
                                  ? Math.sign(t.amount) * t.amount_in_account_currency
                                  : t.amount)
                              }, 0)
                            return (
                              <button
                                key={last4}
                                onClick={() => setSelectedCard(isActive ? null : last4)}
                                className={`group relative h-[68px] w-[108px] rounded-xl border transition-all duration-200 overflow-hidden
                                  ${isActive
                                    ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_4px_20px_hsl(var(--primary)/0.12)]'
                                    : 'border-border/40 hover:border-border/70'
                                  }`}
                              >
                                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-50 group-hover:opacity-80'}`} />
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.03] via-white/[0.06] to-transparent" />
                                <div className="relative h-full flex flex-col justify-between p-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className={`h-3.5 w-5 rounded-[3px] border transition-colors ${isActive ? 'border-amber-400/60 bg-gradient-to-br from-amber-300/30 to-amber-500/20' : 'border-white/10 bg-white/5'}`} />
                                    {isActive && (
                                      <span className="block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
                                    )}
                                  </div>
                                  <div>
                                    <p className={`font-mono text-[11px] font-semibold tracking-widest transition-colors ${isActive ? 'text-white/90' : 'text-white/40 group-hover:text-white/60'}`}>
                                      •••• {last4}
                                    </p>
                                    <p className={`text-[9px] tabular-nums font-semibold mt-0.5 ${isActive ? 'text-white/70' : 'text-white/30 group-hover:text-white/50'}`}>
                                      {formatCurrency(Math.abs(cardTotal), activeCycle.currency_code)}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Transactions / Breakdown tab switcher */}
                      <div className="mx-4 mb-3">
                        <Tabs value={activeView} onValueChange={v => setActiveView(v as 'transactions' | 'breakdown')}>
                          <TabsList className="h-8">
                            <TabsTrigger value="transactions" className="text-xs h-6 px-3">Transactions</TabsTrigger>
                            <TabsTrigger value="breakdown" className="text-xs h-6 px-3">Breakdown</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      {/* Content */}
                      {activeView === 'transactions' ? (
                        <TransactionTableView
                          transactions={filteredTransactions}
                          searchQuery={searchQuery}
                          onSearchChange={setSearchQuery}
                          formatCurrency={formatCurrency}
                          currencyCode={activeCycle.currency_code}
                        />
                      ) : (
                        <CategoryBreakdownView
                          transactions={filteredTransactions}
                          formatCurrency={formatCurrency}
                          currencyCode={activeCycle.currency_code}
                        />
                      )}
                    </TabsContent>
                  )
                })}
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
