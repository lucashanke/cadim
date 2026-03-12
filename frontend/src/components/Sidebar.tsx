import { Activity, LayoutDashboard, TrendingUp, CreditCard, Building } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import type { Page } from '@/types'

interface AppSidebarProps {
  currentPage: Page
  setCurrentPage: (page: Page) => void
}

export function AppSidebar({ currentPage, setCurrentPage }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary shrink-0">
            <span className="text-primary-foreground font-bold font-sans text-sm">c</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">cadim</h2>
          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wide border-accent/40 text-accent py-0 px-1.5 group-data-[collapsible=icon]:hidden">
            Beta
          </Badge>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={currentPage === 'dashboard'} tooltip="Dashboard" onClick={() => setCurrentPage('dashboard')}>
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={currentPage === 'credit-cards'} tooltip="Credit Cards" onClick={() => setCurrentPage('credit-cards')}>
                  <CreditCard />
                  <span>Credit Cards</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={currentPage === 'investments'} tooltip="Investments" onClick={() => setCurrentPage('investments')}>
                  <TrendingUp />
                  <span>Investments</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Institutions" disabled>
                  <Building />
                  <span>Institutions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Status" disabled>
                  <Activity />
                  <span>Status</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:justify-center">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary/30 to-accent/20 flex items-center justify-center text-xs font-bold text-foreground border border-border shrink-0">LH</div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium text-foreground line-clamp-1">Lucas Hanke</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Pro Plan</span>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
