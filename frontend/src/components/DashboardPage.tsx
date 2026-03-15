import { Activity, TrendingUp, PlusCircle, DollarSign, Building, AlertCircle, LogOut, BarChart3, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import type { AccountsSummary, ConnectedItem, HealthStatus, InvestmentsSummary } from '@/types'
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
}: DashboardPageProps) {
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

        <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-6">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Worth</CardTitle>
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="text-3xl font-bold font-heading tracking-tight text-gradient">
              {accountsLoading || investmentsLoading ? (
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
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Institutions</CardTitle>
              <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-all duration-300">
                <Building className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold font-heading tracking-tight text-foreground">
                {accountsLoading ? (
                  <Skeleton className="h-8 w-12 bg-secondary" />
                ) : (
                  accountsSummary?.account_count || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active in {items.length} provider{items.length !== 1 ? 's' : ''}
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

          <Card className="overflow-hidden group transition-shadow hover:shadow-lg hover:shadow-black/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-2.5 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API Status</CardTitle>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-300 ${health?.status === 'ok' ? 'bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-white' : 'bg-red-500/10 text-red-400 group-hover:bg-red-500 group-hover:text-white'}`}>
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-3">
                {loading ? (
                  <Skeleton className="h-8 w-24 bg-secondary" />
                ) : (
                  <div className={`text-xl font-bold ${health?.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                    {health?.status === 'ok' ? 'Operational' : 'Issue Detected'}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {health?.message || 'Connecting to backend...'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="px-5 pt-5 pb-0">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Cash Flow Overview</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Your inflows and outflows for the current month.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider shrink-0">
                Coming soon
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 mt-3">
            <div className="flex items-center justify-center min-h-[220px] rounded-lg bg-secondary/50 border border-dashed border-border">
              <div className="text-center space-y-2">
                <TrendingUp className="h-10 w-10 text-muted-foreground/25 mx-auto" />
                <p className="text-sm text-muted-foreground/50 max-w-[200px] leading-relaxed">
                  Cash flow analytics coming in the next release
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
        { label: 'health', data: health },
        { label: 'items', data: items },
      ]} />
    </>
  )
}
