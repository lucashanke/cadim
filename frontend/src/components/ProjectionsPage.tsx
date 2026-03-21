import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TrendingUp, Percent, Wallet, PiggyBank, ChevronDown, ChevronRight, SlidersHorizontal, Plus, X, Gift, Info } from 'lucide-react'
import { projectNetWorth } from '@/lib/projections'
import { calculateMonthlyIncome, calculateAnnualBonuses } from '@/lib/clt-taxes'
import { getCompensationConfig, saveCompensationConfig } from '@/lib/api'
import type { SalaryDeduction } from '@/lib/storage'
import type { InvestmentPosition, AccountsSummary, MarketRates, ConnectedItem, AverageExpensesResponse } from '@/types'
import { DebugPanel } from './DebugPanel'

interface ProjectionsPageProps {
  positions: InvestmentPosition[]
  accountsSummary: AccountsSummary | null
  items: ConnectedItem[]
  formatCurrency: (value: number, currency: string) => string
}

const stackedChartConfig: ChartConfig = {
  savings: { label: 'Savings', color: 'hsl(215, 30%, 45%)' },
  investments: { label: 'Investments', color: 'hsl(270, 40%, 55%)' },
  compoundInterest: { label: 'Compound Interest', color: 'hsl(150, 50%, 45%)' },
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

export function ProjectionsPage({ positions, accountsSummary, items, formatCurrency }: ProjectionsPageProps) {
  const [rates, setRates] = useState<MarketRates | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [cdiOverride, setCdiOverride] = useState<string>('')
  const [ipcaOverride, setIpcaOverride] = useState<string>('')
  const [grossSalary, setGrossSalary] = useState<string>('')
  const [thirteenthReceived, setThirteenthReceived] = useState<string>('')
  const [vacationThirdReceived, setVacationThirdReceived] = useState<string>('')
  const [deductions, setDeductions] = useState<SalaryDeduction[]>([])
  const [newDeductionName, setNewDeductionName] = useState('')
  const [newDeductionAmount, setNewDeductionAmount] = useState('')
  const [avgExpenses, setAvgExpenses] = useState<string>('')
  const [avgExpensesLoading, setAvgExpensesLoading] = useState(items.length > 0)
  const [monthsAnalyzed, setMonthsAnalyzed] = useState<number>(0)
  const [compoundSavings, setCompoundSavings] = useState<boolean>(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [showIncomeSchedule, setShowIncomeSchedule] = useState(false)
  const [sheetRatesOpen, setSheetRatesOpen] = useState(true)
  const [sheetIncomeOpen, setSheetIncomeOpen] = useState(true)
  const [sheetBonusesOpen, setSheetBonusesOpen] = useState(true)

  const dataReady = !ratesLoading && !avgExpensesLoading

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
      } catch {
        // Leave editable, user can input manually
      } finally {
        setAvgExpensesLoading(false)
      }
    }
    fetchExpenses()
  }, [items])

  // Load compensation config from API
  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await getCompensationConfig()
        if (config) {
          setGrossSalary(config.grossSalary ? String(config.grossSalary) : '')
          setDeductions(config.deductions ?? [])
          setCompoundSavings(config.compoundSavings ?? false)
          const currentYear = new Date().getFullYear()
          if (config.bonusYear === currentYear) {
            setThirteenthReceived(config.thirteenthReceived ? String(config.thirteenthReceived) : '')
            setVacationThirdReceived(config.vacationThirdReceived ? String(config.vacationThirdReceived) : '')
          }
        }
      } catch {
        // Config not found or error — start with empty fields
      } finally {
        setConfigLoaded(true)
      }
    }
    loadConfig()
  }, [])

  // Save compensation config to API (debounced 500ms)
  useEffect(() => {
    if (!configLoaded) return
    const val = parseFloat(grossSalary)
    if (!(val > 0)) return

    const timer = setTimeout(() => {
      saveCompensationConfig({
        grossSalary: val,
        deductions,
        thirteenthReceived: parseFloat(thirteenthReceived) || 0,
        vacationThirdReceived: parseFloat(vacationThirdReceived) || 0,
        bonusYear: new Date().getFullYear(),
        compoundSavings,
      }).catch(err => console.warn('Failed to save compensation config', err))
    }, 500)
    return () => clearTimeout(timer)
  }, [grossSalary, deductions, thirteenthReceived, vacationThirdReceived, compoundSavings, configLoaded])

  const cdiAnnual = parseFloat(cdiOverride) || 0
  const ipcaAnnual = parseFloat(ipcaOverride) || 0
  const accountsBalance = accountsSummary?.total_balance ?? 0
  const grossSalaryNum = parseFloat(grossSalary) || 0
  const avgExpensesNum = parseFloat(avgExpenses) || 0
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0)
  const thirteenthReceivedNum = parseFloat(thirteenthReceived) || 0
  const vacationThirdReceivedNum = parseFloat(vacationThirdReceived) || 0

  const bonuses = useMemo(
    () => grossSalaryNum > 0 ? calculateAnnualBonuses(grossSalaryNum) : null,
    [grossSalaryNum],
  )

  const projectionData = useMemo(
    () =>
      projectNetWorth({
        positions,
        accountsBalance,
        cdiAnnual,
        ipcaAnnual,
        grossSalary: grossSalaryNum,
        avgMonthlyExpenses: avgExpensesNum,
        otherDeductions: totalDeductions,
        thirteenthReceived: thirteenthReceivedNum,
        vacationThirdReceived: vacationThirdReceivedNum,
        compoundSavings,
      }),
    [positions, accountsBalance, cdiAnnual, ipcaAnnual, grossSalaryNum, avgExpensesNum, totalDeductions, thirteenthReceivedNum, vacationThirdReceivedNum, compoundSavings],
  )

  const currentTotal = projectionData[0]?.total ?? 0
  const decemberKey = `${new Date().getFullYear()}-12`
  const decemberPoint = projectionData.find(p => p.month === decemberKey)
  const decemberLabel = decemberPoint?.label ?? ''
  const endOfYearTotal = decemberPoint?.total ?? projectionData[projectionData.length - 1]?.total ?? 0
  const growthPct = currentTotal > 0 ? ((endOfYearTotal - currentTotal) / currentTotal) * 100 : 0

  // Regular month income for display
  const regularIncome = grossSalaryNum > 0 ? calculateMonthlyIncome(grossSalaryNum, totalDeductions) : null
  const monthlySurplus = regularIncome ? regularIncome.netIncome - avgExpensesNum : 0

  // Income schedule: month-by-month projected income
  const incomeSchedule = useMemo(() => {
    if (grossSalaryNum <= 0) return []
    const now = new Date()
    const year = now.getFullYear()
    const rows: { month: string; monthIdx: number; gross: number; inss: number; irrf: number; otherDeductions: number; net: number; note: string }[] = []
    for (let m = now.getMonth(); m <= 11; m++) {
      const income = calculateMonthlyIncome(grossSalaryNum, totalDeductions)
      const note = m === 11 ? '+ 13th & vacation 1/3' : ''
      rows.push({
        month: `${MONTH_NAMES[m]} ${year}`,
        monthIdx: m,
        gross: income.grossBeforeTax,
        inss: income.inss,
        irrf: income.irrf,
        otherDeductions: income.otherDeductions,
        net: income.netIncome,
        note,
      })
    }
    return rows
  }, [grossSalaryNum, totalDeductions])

  // Growth attribution: contributions vs compound interest
  const growthAttribution = useMemo(() => {
    if (projectionData.length < 2) return null
    const totalGain = endOfYearTotal - currentTotal
    const now = new Date()
    let totalContributions = 0
    for (let m = now.getMonth() + 1; m <= 11; m++) {
      let contribution = -avgExpensesNum
      if (grossSalaryNum > 0) {
        const income = calculateMonthlyIncome(grossSalaryNum, totalDeductions)
        contribution += income.netIncome
        if (m === 11 && bonuses) {
          const thirteenthRemaining = Math.max(0, bonuses.thirteenthNet - thirteenthReceivedNum)
          const vacationThirdRemaining = Math.max(0, bonuses.vacationThirdNet - vacationThirdReceivedNum)
          contribution += thirteenthRemaining + vacationThirdRemaining
        }
      }
      totalContributions += contribution
    }
    const fromInterest = totalGain - totalContributions
    return { totalGain, totalContributions, fromInterest }
  }, [projectionData, endOfYearTotal, currentTotal, grossSalaryNum, avgExpensesNum, totalDeductions, bonuses, thirteenthReceivedNum, vacationThirdReceivedNum])

  return (
    <div className="space-y-6">
      {/* 1. Page Header with Settings Sheet trigger */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Net Worth Projection</h1>
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
            <div className="px-4 space-y-1 overflow-y-auto flex-1">
              {/* Market Rates — collapsible */}
              <div className="border-b border-border pb-1">
                <button
                  className="flex items-center gap-2 w-full text-left py-2.5"
                  onClick={() => setSheetRatesOpen(!sheetRatesOpen)}
                >
                  {sheetRatesOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <Percent className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm font-semibold">Market Rates</span>
                  {!sheetRatesOpen && (
                    <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                      CDI {cdiAnnual.toFixed(2)}% · IPCA {ipcaAnnual.toFixed(2)}%
                    </span>
                  )}
                </button>
                {sheetRatesOpen && (
                  <div className="pb-3 space-y-3">
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
                        <label htmlFor="compound-savings" className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            id="compound-savings"
                            type="checkbox"
                            checked={compoundSavings}
                            onChange={(e) => setCompoundSavings(e.target.checked)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            Compound savings at CDI
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] text-xs">
                                Enable if your bank balance earns CDI (e.g. CDB, remunerated account). Disable for regular checking accounts.
                              </TooltipContent>
                            </Tooltip>
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Income & Expenses — collapsible */}
              <div className="border-b border-border pb-1">
                <button
                  className="flex items-center gap-2 w-full text-left py-2.5"
                  onClick={() => setSheetIncomeOpen(!sheetIncomeOpen)}
                >
                  {sheetIncomeOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm font-semibold">Income & Expenses</span>
                  {!sheetIncomeOpen && regularIncome && (
                    <span className={`ml-auto text-[11px] tabular-nums ${monthlySurplus >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                      Surplus {formatCurrency(monthlySurplus, 'BRL')}
                    </span>
                  )}
                </button>
                {sheetIncomeOpen && (
                  <div className="pb-3 space-y-3">
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
                    {/* Other Deductions */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Other Deductions (R$/mo)
                      </Label>
                      {deductions.map((d, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs truncate flex-1">{d.name}</span>
                          <span className="text-xs tabular-nums font-mono">{d.amount.toFixed(2)}</span>
                          <button
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => setDeductions(prev => prev.filter((_, i) => i !== idx))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Input
                            placeholder="Name"
                            value={newDeductionName}
                            onChange={(e) => setNewDeductionName(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newDeductionAmount}
                            onChange={(e) => setNewDeductionAmount(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          disabled={!newDeductionName.trim() || !parseFloat(newDeductionAmount)}
                          onClick={() => {
                            setDeductions(prev => [...prev, { name: newDeductionName.trim(), amount: parseFloat(newDeductionAmount) }])
                            setNewDeductionName('')
                            setNewDeductionAmount('')
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {totalDeductions > 0 && (
                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-muted-foreground">Total deductions</span>
                          <span className="font-semibold">{formatCurrency(totalDeductions, 'BRL')}</span>
                        </div>
                      )}
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
                    {regularIncome && (
                      <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Tax Breakdown</p>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">INSS</span>
                          <span className="font-semibold">{formatCurrency(regularIncome.inss, 'BRL')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IRRF</span>
                          <span className="font-semibold">{formatCurrency(regularIncome.irrf, 'BRL')}</span>
                        </div>
                        {regularIncome.otherDeductions > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Other Deductions</span>
                            <span className="font-semibold">{formatCurrency(regularIncome.otherDeductions, 'BRL')}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Income</span>
                          <span className="font-semibold">{formatCurrency(regularIncome.netIncome, 'BRL')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            Monthly Surplus
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] text-xs">
                                Net income ({formatCurrency(regularIncome.netIncome, 'BRL')}) minus avg monthly expenses ({formatCurrency(avgExpensesNum, 'BRL')})
                              </TooltipContent>
                            </Tooltip>
                          </span>
                          <span className={`font-semibold ${monthlySurplus >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {formatCurrency(monthlySurplus, 'BRL')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Additional Income — collapsible (December bonuses) */}
              {bonuses && grossSalaryNum > 0 && (
                <div className="pb-1">
                  <button
                    className="flex items-center gap-2 w-full text-left py-2.5"
                    onClick={() => setSheetBonusesOpen(!sheetBonusesOpen)}
                  >
                    {sheetBonusesOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <Gift className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm font-semibold">Additional Income</span>
                    {!sheetBonusesOpen && (
                      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                        {formatCurrency(
                          Math.max(0, bonuses.thirteenthNet - thirteenthReceivedNum) + Math.max(0, bonuses.vacationThirdNet - vacationThirdReceivedNum),
                          'BRL',
                        )} remaining
                      </span>
                    )}
                  </button>
                  {sheetBonusesOpen && (
                    <div className="pb-3 space-y-3">
                      <span className="text-[11px] text-muted-foreground">December lump sums</span>
                      {/* 13th Salary */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">13th Salary</span>
                          <span className="text-muted-foreground">Expected: {formatCurrency(bonuses.thirteenthNet, 'BRL')}</span>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="thirteenth-received" className="text-xs text-muted-foreground">
                            Amount received (R$)
                          </Label>
                          <Input
                            id="thirteenth-received"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={thirteenthReceived}
                            onChange={(e) => setThirteenthReceived(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${Math.min(100, (thirteenthReceivedNum / bonuses.thirteenthNet) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">{Math.min(100, Math.round((thirteenthReceivedNum / bonuses.thirteenthNet) * 100))}%</span>
                        </div>
                      </div>
                      {/* Vacation 1/3 */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">Vacation 1/3</span>
                          <span className="text-muted-foreground">Expected: {formatCurrency(bonuses.vacationThirdNet, 'BRL')}</span>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="vacation-received" className="text-xs text-muted-foreground">
                            Amount received (R$)
                          </Label>
                          <Input
                            id="vacation-received"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={vacationThirdReceived}
                            onChange={(e) => setVacationThirdReceived(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${Math.min(100, (vacationThirdReceivedNum / bonuses.vacationThirdNet) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right">{Math.min(100, Math.round((vacationThirdReceivedNum / bonuses.vacationThirdNet) * 100))}%</span>
                        </div>
                      </div>
                      {/* Total remaining summary */}
                      <div className="rounded-lg bg-muted/30 p-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Remaining for December</span>
                          <span className="font-semibold">{formatCurrency(
                            Math.max(0, bonuses.thirteenthNet - thirteenthReceivedNum) + Math.max(0, bonuses.vacationThirdNet - vacationThirdReceivedNum),
                            'BRL',
                          )}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {!dataReady ? (
        <>
          {/* Skeleton KPI cards with staggered rise-in + shimmer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2].map((i) => (
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

          {/* Skeleton chart with animated bars */}
          <Card
            className="overflow-hidden shimmer opacity-0"
            style={{ animation: 'rise-in 0.5s ease-out 0.36s forwards' }}
          >
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40 rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[350px] flex items-end gap-[3%] px-4 pb-6 pt-4">
                {[0.4, 0.55, 0.65, 0.5, 0.7, 0.8, 0.75, 0.9, 0.85, 0.95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 origin-bottom rounded-t bg-muted"
                    style={{
                      height: `${h * 100}%`,
                      animation: `chart-grow 0.6s ease-out ${0.5 + i * 0.06}s both`,
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
      <>
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
            <div className="text-2xl font-bold font-heading tracking-tight">
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
            <div className="text-2xl font-bold font-heading tracking-tight">
              {formatCurrency(endOfYearTotal, 'BRL')}
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
            <div className="text-2xl font-bold font-heading tracking-tight">
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
              <div className={`text-2xl font-bold font-heading tracking-tight ${monthlySurplus >= 0 ? '' : 'text-red-400'}`}>
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
                />
                <Area
                  type="monotone"
                  dataKey="compoundInterest"
                  stackId="1"
                  stroke="var(--color-compoundInterest)"
                  strokeWidth={2}
                  fill="var(--color-compoundInterest)"
                  fillOpacity={0.4}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                />
                {decemberLabel && (
                  <ReferenceLine
                    x={decemberLabel}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    label={{ value: `Dec ${new Date().getFullYear()}`, position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))', dy: 8, dx: 4 }}
                  />
                )}
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
                      {totalDeductions > 0 && <th className="text-right py-2 px-2 font-medium">Other</th>}
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
                        {totalDeductions > 0 && <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">{formatCurrency(row.otherDeductions, 'BRL')}</td>}
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

      <DebugPanel sections={[
        { label: 'accountsSummary', data: accountsSummary },
        { label: 'accountsBalance', data: accountsBalance },
        { label: 'positions', data: positions },
        { label: 'currentTotal (net worth)', data: { currentTotal, breakdown: { savings: projectionData[0]?.savings, investments: projectionData[0]?.investments } } },
        { label: 'projectionData', data: projectionData },
        { label: 'rates', data: { cdiAnnual, ipcaAnnual, rawRates: rates } },
        { label: 'income & expenses', data: { grossSalary: grossSalaryNum, avgExpenses: avgExpensesNum, monthlySurplus, regularIncome } },
        { label: 'growthAttribution', data: growthAttribution },
        { label: 'items', data: items },
      ]} />
      </>
      )}
    </div>
  )
}
