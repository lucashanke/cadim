import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { TrendingUp, Percent, Wallet, PiggyBank, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { projectNetWorth } from '@/lib/projections'
import { calculateMonthlyIncome } from '@/lib/clt-taxes'
import { getSalaryConfig, saveSalaryConfig } from '@/lib/storage'
import type { InvestmentPosition, AccountsSummary, MarketRates, ConnectedItem, AverageExpensesResponse, ExpenseMonthBreakdown } from '@/types'

interface ProjectionsPageProps {
  positions: InvestmentPosition[]
  accountsSummary: AccountsSummary | null
  manualTotal: number
  items: ConnectedItem[]
  formatCurrency: (value: number, currency: string) => string
}

const stackedChartConfig: ChartConfig = {
  savings: { label: 'Savings', color: 'hsl(215, 30%, 45%)' },
  investments: { label: 'Investments', color: 'hsl(270, 40%, 55%)' },
  manual: { label: 'Manual Positions', color: 'hsl(38, 85%, 50%)' },
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const CustomTooltip = ({ active, payload, label, formatCurrency }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; formatCurrency: (v: number, c: string) => string }) => {
  if (!active || !payload?.length) return null
  const entries = [...payload].reverse().filter(e => e.value > 0)
  const total = entries.reduce((sum, e) => sum + e.value, 0)
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-xl text-xs min-w-[200px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {entries.map(e => (
          <div key={e.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
              <span className="text-muted-foreground truncate">{e.name}</span>
            </div>
            <span className="font-mono font-medium tabular-nums text-foreground">{formatCurrency(e.value, 'BRL')}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(total, 'BRL')}</span>
      </div>
    </div>
  )
}

export function ProjectionsPage({ positions, accountsSummary, manualTotal, items, formatCurrency }: ProjectionsPageProps) {
  const [rates, setRates] = useState<MarketRates | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [cdiOverride, setCdiOverride] = useState<string>('')
  const [ipcaOverride, setIpcaOverride] = useState<string>('')
  const [grossSalary, setGrossSalary] = useState<string>(() => {
    const saved = getSalaryConfig()
    return saved ? String(saved.grossSalary) : ''
  })
  const [avgExpenses, setAvgExpenses] = useState<string>('')
  const [avgExpensesLoading, setAvgExpensesLoading] = useState(false)
  const [monthsAnalyzed, setMonthsAnalyzed] = useState<number>(0)
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<ExpenseMonthBreakdown[]>([])
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [showIncomeSchedule, setShowIncomeSchedule] = useState(false)

  useEffect(() => {
    async function fetchRates() {
      try {
        const res = await fetch('/api/rates')
        if (!res.ok) throw new Error('Failed to fetch rates')
        const data: MarketRates = await res.json()
        setRates(data)
        setCdiOverride(data.cdi_annual.toFixed(2))
        setIpcaOverride(data.ipca_annual.toFixed(2))
      } catch {
        setCdiOverride('13.25')
        setIpcaOverride('5.00')
      } finally {
        setRatesLoading(false)
      }
    }
    fetchRates()
  }, [])

  useEffect(() => {
    if (items.length === 0) return
    async function fetchExpenses() {
      setAvgExpensesLoading(true)
      try {
        const itemIds = items.map(i => encodeURIComponent(i.id)).join(',')
        const res = await fetch(`/api/accounts/expenses?item_ids=${itemIds}`)
        if (!res.ok) throw new Error('Failed to fetch expenses')
        const data: AverageExpensesResponse = await res.json()
        setAvgExpenses(data.average_monthly_expenses.toFixed(2))
        setMonthsAnalyzed(data.months_analyzed)
        setMonthlyBreakdown(data.monthly_breakdown)
      } catch {
        // Leave editable, user can input manually
      } finally {
        setAvgExpensesLoading(false)
      }
    }
    fetchExpenses()
  }, [items])

  useEffect(() => {
    const val = parseFloat(grossSalary)
    if (val > 0) {
      saveSalaryConfig({ grossSalary: val })
    }
  }, [grossSalary])

  const cdiAnnual = parseFloat(cdiOverride) || 0
  const ipcaAnnual = parseFloat(ipcaOverride) || 0
  const accountsBalance = accountsSummary?.total_balance ?? 0
  const grossSalaryNum = parseFloat(grossSalary) || 0
  const avgExpensesNum = parseFloat(avgExpenses) || 0

  const projectionData = useMemo(
    () =>
      projectNetWorth({
        positions,
        accountsBalance,
        manualTotal,
        cdiAnnual,
        ipcaAnnual,
        grossSalary: grossSalaryNum,
        avgMonthlyExpenses: avgExpensesNum,
      }),
    [positions, accountsBalance, manualTotal, cdiAnnual, ipcaAnnual, grossSalaryNum, avgExpensesNum],
  )

  const currentTotal = projectionData[0]?.total ?? 0
  const endTotal = projectionData[projectionData.length - 1]?.total ?? 0
  const growthPct = currentTotal > 0 ? ((endTotal - currentTotal) / currentTotal) * 100 : 0

  // Regular month income for display
  const regularIncome = grossSalaryNum > 0 ? calculateMonthlyIncome(grossSalaryNum, 3) : null
  const monthlySurplus = regularIncome ? regularIncome.netIncome - avgExpensesNum : 0

  // Income schedule: month-by-month projected income
  const incomeSchedule = useMemo(() => {
    if (grossSalaryNum <= 0) return []
    const now = new Date()
    const year = now.getFullYear()
    const rows: { month: string; monthIdx: number; gross: number; inss: number; irrf: number; net: number; note: string }[] = []
    for (let m = now.getMonth(); m <= 11; m++) {
      const income = calculateMonthlyIncome(grossSalaryNum, m)
      let note = ''
      if (m === 10) note = '13th 1st installment'
      if (m === 11) note = '13th 2nd installment'
      rows.push({
        month: `${MONTH_NAMES[m]} ${year}`,
        monthIdx: m,
        gross: income.grossBeforeTax,
        inss: income.inss,
        irrf: income.irrf,
        net: income.netIncome,
        note,
      })
    }
    return rows
  }, [grossSalaryNum])

  // Category summary from expense breakdown
  const categorySummary = useMemo(() => {
    if (monthlyBreakdown.length === 0) return []
    const map = new Map<string, number>()
    for (const month of monthlyBreakdown) {
      for (const tx of month.transactions) {
        const cat = tx.category || 'Uncategorized'
        map.set(cat, (map.get(cat) ?? 0) + tx.amount)
      }
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [monthlyBreakdown])

  // Growth attribution: contributions vs compound interest
  const growthAttribution = useMemo(() => {
    if (projectionData.length < 2) return null
    const totalGain = endTotal - currentTotal
    const now = new Date()
    let totalContributions = 0
    for (let m = now.getMonth() + 1; m <= 11; m++) {
      if (grossSalaryNum > 0) {
        const income = calculateMonthlyIncome(grossSalaryNum, m)
        totalContributions += income.netIncome - avgExpensesNum
      }
    }
    const fromInterest = totalGain - totalContributions
    return { totalGain, totalContributions, fromInterest }
  }, [projectionData, endTotal, currentTotal, grossSalaryNum, avgExpensesNum])

  return (
    <div className="space-y-6">
      {/* 1. Page Header with Settings Sheet trigger */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Net Worth Projection</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Projected growth through end of year with savings, investments, and income breakdown
          </p>
          {/* Assumption badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {cdiAnnual > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
                CDI {cdiAnnual.toFixed(2)}%
              </span>
            )}
            {ipcaAnnual > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
                IPCA {ipcaAnnual.toFixed(2)}%
              </span>
            )}
            {grossSalaryNum > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
                Salary {formatCurrency(grossSalaryNum, 'BRL')}
              </span>
            )}
            {avgExpensesNum > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-0.5">
                Expenses {formatCurrency(avgExpensesNum, 'BRL')}
              </span>
            )}
          </div>
        </div>
        <Sheet>
          <SheetTrigger render={
            <Button variant="outline" size="icon" className="shrink-0 mt-1" />
          }>
            <SlidersHorizontal className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Projection Settings</SheetTitle>
              <SheetDescription>
                Adjust market rates and income assumptions used for projections.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 space-y-6 overflow-y-auto flex-1">
              {/* Market Rates */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Percent className="h-3.5 w-3.5" />
                  Market Rates
                </h3>
                {ratesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="cdi-rate" className="text-xs text-muted-foreground">
                        CDI Annual (%)
                        {rates && <span className="ml-1 opacity-60">— from BCB</span>}
                      </Label>
                      <Input
                        id="cdi-rate"
                        type="number"
                        step="0.01"
                        value={cdiOverride}
                        onChange={(e) => setCdiOverride(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ipca-rate" className="text-xs text-muted-foreground">
                        IPCA Annual (%)
                        {rates && <span className="ml-1 opacity-60">— from BCB</span>}
                      </Label>
                      <Input
                        id="ipca-rate"
                        type="number"
                        step="0.01"
                        value={ipcaOverride}
                        onChange={(e) => setIpcaOverride(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border" />

              {/* Income & Expenses */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5" />
                  Income & Expenses
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="gross-salary" className="text-xs text-muted-foreground">
                      Gross Salary (R$)
                    </Label>
                    <Input
                      id="gross-salary"
                      type="number"
                      step="100"
                      placeholder="0.00"
                      value={grossSalary}
                      onChange={(e) => setGrossSalary(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="avg-expenses" className="text-xs text-muted-foreground">
                      Avg Monthly Expenses (R$)
                      {monthsAnalyzed > 0 && (
                        <span className="ml-1 opacity-60">— from {monthsAnalyzed} months</span>
                      )}
                    </Label>
                    {avgExpensesLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Input
                        id="avg-expenses"
                        type="number"
                        step="100"
                        placeholder="0.00"
                        value={avgExpenses}
                        onChange={(e) => setAvgExpenses(e.target.value)}
                      />
                    )}
                  </div>
                </div>
                {regularIncome && (
                  <div className="space-y-1.5 text-xs border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Income</span>
                      <span className="font-semibold">{formatCurrency(regularIncome.netIncome, 'BRL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">INSS</span>
                      <span className="font-semibold">{formatCurrency(regularIncome.inss, 'BRL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IRRF</span>
                      <span className="font-semibold">{formatCurrency(regularIncome.irrf, 'BRL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Surplus</span>
                      <span className={`font-semibold ${monthlySurplus >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {formatCurrency(monthlySurplus, 'BRL')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Net Worth */}
        <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Net Worth
            </CardTitle>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrency(currentTotal, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current portfolio value
            </p>
          </CardContent>
        </Card>

        {/* Projected Dec */}
        <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projected Dec {new Date().getFullYear()}
            </CardTitle>
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:bg-violet-500 group-hover:text-white transition-all duration-300">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrency(endTotal, 'BRL')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              End of year estimate
            </p>
          </CardContent>
        </Card>

        {/* Projected Growth */}
        <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projected Growth
            </CardTitle>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
              <Percent className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-2xl font-bold tracking-tight">
              {growthPct.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Through December
            </p>
          </CardContent>
        </Card>

        {/* Monthly Surplus (only when salary > 0) */}
        {grossSalaryNum > 0 && (
          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Surplus
              </CardTitle>
              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                <PiggyBank className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className={`text-2xl font-bold tracking-tight ${monthlySurplus >= 0 ? '' : 'text-red-400'}`}>
                {formatCurrency(monthlySurplus, 'BRL')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Net income minus expenses
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 4. Stacked Area Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Projection</CardTitle>
        </CardHeader>
        <CardContent>
          {projectionData.length > 0 ? (
            <ChartContainer config={stackedChartConfig} className="h-[350px] w-full aspect-auto">
              <AreaChart data={projectionData} margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v, 'BRL')}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <ChartTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                <Area
                  type="monotone"
                  dataKey="manual"
                  stackId="1"
                  stroke="var(--color-manual)"
                  strokeWidth={0}
                  fill="var(--color-manual)"
                  fillOpacity={0.5}
                />
                <Area
                  type="monotone"
                  dataKey="investments"
                  stackId="1"
                  stroke="var(--color-investments)"
                  strokeWidth={1}
                  fill="var(--color-investments)"
                  fillOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="savings"
                  stackId="1"
                  stroke="var(--color-savings)"
                  strokeWidth={2}
                  fill="var(--color-savings)"
                  fillOpacity={0.3}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No data to project. Connect a bank or add manual positions.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 5. Year-End Insights */}
      {growthAttribution && growthAttribution.totalGain !== 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Year-End Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total projected gain</span>
                <span className="text-lg font-bold">{formatCurrency(growthAttribution.totalGain, 'BRL')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From salary contributions</p>
                  <p className="text-xl font-bold">{formatCurrency(growthAttribution.totalContributions, 'BRL')}</p>
                  <p className="text-xs text-muted-foreground">What you put in</p>
                  {growthAttribution.totalGain > 0 && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(0, Math.min(100, (growthAttribution.totalContributions / growthAttribution.totalGain) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From compound interest</p>
                  <p className="text-xl font-bold">{formatCurrency(growthAttribution.fromInterest, 'BRL')}</p>
                  <p className="text-xs text-muted-foreground">What your money earned</p>
                  {growthAttribution.totalGain > 0 && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.max(0, Math.min(100, (growthAttribution.fromInterest / growthAttribution.totalGain) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Income Schedule (collapsible, when salary > 0) */}
      {grossSalaryNum > 0 && incomeSchedule.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              className="flex items-center gap-2 text-base font-semibold w-full text-left"
              onClick={() => setShowIncomeSchedule(!showIncomeSchedule)}
            >
              {showIncomeSchedule ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Income Schedule
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({incomeSchedule.length} months)
              </span>
            </button>
          </CardHeader>
          {showIncomeSchedule && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Month</th>
                      <th className="text-right py-2 px-2 font-medium">Gross</th>
                      <th className="text-right py-2 px-2 font-medium">INSS</th>
                      <th className="text-right py-2 px-2 font-medium">IRRF</th>
                      <th className="text-right py-2 px-2 font-medium">Net</th>
                      <th className="text-left py-2 pl-4 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeSchedule.map((row) => (
                      <tr
                        key={row.month}
                        className={`border-b border-border/40 ${row.note ? 'bg-amber-500/5' : ''}`}
                      >
                        <td className="py-2 pr-4 font-medium">{row.month}</td>
                        <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(row.gross, 'BRL')}</td>
                        <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">{formatCurrency(row.inss, 'BRL')}</td>
                        <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">{formatCurrency(row.irrf, 'BRL')}</td>
                        <td className="text-right py-2 px-2 tabular-nums font-semibold">{formatCurrency(row.net, 'BRL')}</td>
                        <td className="py-2 pl-4 text-amber-500">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 7. Expense Breakdown (collapsible) */}
      {monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <button
              className="flex items-center gap-2 text-base font-semibold w-full text-left"
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              {showBreakdown ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Expense Breakdown
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({monthlyBreakdown.reduce((s, m) => s + m.transactions.length, 0)} transactions)
              </span>
            </button>
          </CardHeader>
          {showBreakdown && (
            <CardContent className="space-y-4">
              {/* Category summary */}
              {categorySummary.length > 0 && (
                <div className="space-y-2 pb-3 border-b border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">By Category</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {categorySummary.slice(0, 10).map((cat) => {
                      const totalExpenses = categorySummary.reduce((s, c) => s + c.amount, 0)
                      const pct = totalExpenses > 0 ? (cat.amount / totalExpenses) * 100 : 0
                      return (
                        <div key={cat.name} className="flex items-center gap-2 text-xs">
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                            <span className="truncate text-foreground">{cat.name}</span>
                            <span className="font-semibold tabular-nums shrink-0">{formatCurrency(cat.amount, 'BRL')}</span>
                          </div>
                          <span className="text-muted-foreground tabular-nums w-10 text-right shrink-0">{pct.toFixed(0)}%</span>
                        </div>
                      )
                    })}
                    {categorySummary.length > 10 && (
                      <p className="text-xs text-muted-foreground col-span-full">
                        + {categorySummary.length - 10} more categories
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Per-month transactions */}
              {monthlyBreakdown.map((month) => {
                const isExpanded = expandedMonths.has(month.month)
                const monthLabel = new Date(month.month + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                return (
                  <div key={month.month}>
                    <button
                      className="flex items-center justify-between w-full text-left py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
                      onClick={() => {
                        setExpandedMonths(prev => {
                          const next = new Set(prev)
                          if (next.has(month.month)) next.delete(month.month)
                          else next.add(month.month)
                          return next
                        })
                      }}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        {monthLabel}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({month.transactions.length} transactions)
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(month.total, 'BRL')}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {month.transactions.map((tx, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                            <div className="flex-1 min-w-0">
                              <span className="text-foreground truncate block">{tx.description}</span>
                              <span className="text-muted-foreground">
                                {tx.date.slice(0, 10)}
                                {tx.category && <> &middot; {tx.category}</>}
                              </span>
                            </div>
                            <span className="text-foreground font-medium tabular-nums ml-4 shrink-0">
                              {formatCurrency(tx.amount, 'BRL')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
