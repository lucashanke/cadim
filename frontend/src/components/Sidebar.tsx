import { Activity, LayoutDashboard, TrendingUp, CreditCard, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Page } from '@/types'

interface SidebarProps {
  currentPage: Page
  setCurrentPage: (page: Page) => void
}

export function Sidebar({ currentPage, setCurrentPage }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card shrink-0">
      <div className="flex h-16 items-center px-5 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary shrink-0">
            <span className="text-primary-foreground font-bold font-sans text-sm">c</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">cadim</h2>
          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wide border-accent/40 text-accent py-0 px-1.5">
            Beta
          </Badge>
        </div>
      </div>
      <div className="flex-1 overflow-auto py-4 px-3">
        <nav className="flex flex-col gap-0.5 text-sm">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2.5 px-3 py-2 rounded-lg text-sm ${currentPage === 'dashboard' ? 'nav-active' : 'text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors'}`}
            onClick={() => setCurrentPage('dashboard')}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <CreditCard className="h-4 w-4" />
            Overview
          </Button>
          <Button
            variant="ghost"
            className={`w-full justify-start gap-2.5 px-3 py-2 rounded-lg text-sm ${currentPage === 'investments' ? 'nav-active' : 'text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors'}`}
            onClick={() => setCurrentPage('investments')}
          >
            <TrendingUp className="h-4 w-4" />
            Investments
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Building className="h-4 w-4" />
            Institutions
          </Button>
          <div className="mt-5 mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
            System
          </div>
          <Button variant="ghost" className="w-full justify-start gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Activity className="h-4 w-4" />
            Status
          </Button>
        </nav>
      </div>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary transition-colors">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary/30 to-accent/20 flex items-center justify-center text-xs font-bold text-foreground border border-border shrink-0">LH</div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground line-clamp-1">Lucas Hanke</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Pro Plan</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
