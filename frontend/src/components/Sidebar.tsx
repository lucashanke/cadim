import { useState } from 'react'
import { Activity, LayoutDashboard, TrendingUp, CreditCard, Building, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Page } from '@/types'

interface SidebarProps {
  currentPage: Page
  setCurrentPage: (page: Page) => void
}

export function Sidebar({ currentPage, setCurrentPage }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const navItem = (page: Page | null, icon: React.ReactNode, label: string, disabled = false) => {
    const isActive = page !== null && currentPage === page
    const base = `py-2 rounded-lg text-sm ${isActive ? 'nav-active' : 'text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors'}`
    return (
      <Button
        variant="ghost"
        className={`w-full ${collapsed ? 'justify-center px-0' : 'justify-start gap-2.5 px-3'} ${base}`}
        onClick={page && !disabled ? () => setCurrentPage(page) : undefined}
        disabled={disabled}
      >
        {icon}
        {!collapsed && label}
      </Button>
    )
  }

  return (
    <aside className={`hidden md:flex flex-col border-r border-border bg-card shrink-0 transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border shrink-0 px-3 gap-2">
        <div className={`flex items-center gap-2 flex-1 overflow-hidden ${collapsed ? 'justify-center' : ''}`}>
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary shrink-0">
            <span className="text-primary-foreground font-bold font-sans text-sm">c</span>
          </div>
          {!collapsed && (
            <>
              <h2 className="text-xl font-bold tracking-tight text-foreground">cadim</h2>
              <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wide border-accent/40 text-accent py-0 px-1.5">
                Beta
              </Badge>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-auto py-4 px-2">
        <nav className="flex flex-col gap-0.5 text-sm">
          {navItem('dashboard', <LayoutDashboard className="h-4 w-4 shrink-0" />, 'Dashboard')}
          {navItem('credit-cards', <CreditCard className="h-4 w-4 shrink-0" />, 'Credit Cards')}
          {navItem('investments', <TrendingUp className="h-4 w-4 shrink-0" />, 'Investments')}
          {navItem(null, <Building className="h-4 w-4 shrink-0" />, 'Institutions', true)}
          {!collapsed && (
            <div className="mt-5 mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
              System
            </div>
          )}
          {collapsed && <div className="mt-3 mb-1 border-t border-border" />}
          {navItem(null, <Activity className="h-4 w-4 shrink-0" />, 'Status', true)}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5 px-2.5'} py-2 rounded-lg hover:bg-secondary transition-colors`}>
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary/30 to-accent/20 flex items-center justify-center text-xs font-bold text-foreground border border-border shrink-0">LH</div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-foreground line-clamp-1">Lucas Hanke</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Pro Plan</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
