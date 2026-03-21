import { Activity, LayoutDashboard, TrendingUp, CreditCard, Building, LineChart } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/Logo'
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

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1">
          <Logo size={28} className="shrink-0" />
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
                <SidebarMenuButton isActive={pathname === '/'} tooltip="Dashboard" render={<Link to="/" />}>
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === '/credit-cards'} tooltip="Credit Cards" render={<Link to="/credit-cards" />}>
                  <CreditCard />
                  <span>Credit Cards</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === '/investments'} tooltip="Investments" render={<Link to="/investments" />}>
                  <TrendingUp />
                  <span>Investments</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === '/projections'} tooltip="Projections" render={<Link to="/projections" />}>
                  <LineChart />
                  <span>Projections</span>
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
