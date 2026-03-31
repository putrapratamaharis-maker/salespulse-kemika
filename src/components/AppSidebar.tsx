import {
  LayoutDashboard, User, Users, PieChart, TrendingUp, DollarSign,
  Package, CreditCard, Settings, ChevronDown, BarChart3, Target, Activity, GitBranch, Building2,
  Database, UserCog, ClipboardList
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAppContext } from '@/context/AppContext';
import { useLocation } from 'react-router-dom';

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';

const allMyPerformanceSubItems = [
  { title: 'My Sales Overview', url: '/my-performance', icon: BarChart3, salesOnly: true },
  { title: "My KPI's & Scores", url: '/my-performance/kpis', icon: Target, salesOnly: false },
  { title: 'My Activities', url: '/my-performance/activities', icon: Activity, salesOnly: false },
  { title: 'My Leads & Forecast', url: '/my-performance/pipeline', icon: GitBranch, salesOnly: true },
];

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Team Performance', url: '/team-performance', icon: Users },
  { title: 'Segment Performance', url: '/segment-performance', icon: PieChart },
  { title: 'Pipeline & Forecast', url: '/pipeline', icon: TrendingUp },
  { title: 'Revenue & Margin', url: '/revenue', icon: DollarSign },
  { title: 'Product Performance', url: '/products', icon: Package },
  { title: 'AR & Cashflow', url: '/ar-cashflow', icon: CreditCard },
];

const allMasterDataSubItems = [
  { title: 'Akun / Customer', url: '/accounts', icon: Building2, minRole: 'staff' as const },
  { title: 'Produk', url: '/product-master', icon: Package, minRole: 'staff' as const },
  { title: 'User', url: '/users', icon: UserCog, minRole: 'super_admin' as const },
];

const adminItems = [
  { title: 'Admin Panel', url: '/admin', icon: Settings, superOnly: false },
  { title: 'Audit Log', url: '/audit-log', icon: ClipboardList, superOnly: true },
];

const orgRoleLabels: Record<string, string> = {
  sales_manager: 'Sales Manager',
  supervisor: 'Supervisor',
  sales_person: 'Sales Person',
  representative_management: 'Rep. Management',
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { currentUser, setCurrentUser } = useAppContext();
  const location = useLocation();

  const orgRole = currentUser?.orgRole || 'staff_operational';
  const systemRole = currentUser?.systemRole || 'viewer';
  const showSalesMenus = orgRole === 'staff_operational' && systemRole === 'staff';
  const myPerformanceSubItems = allMyPerformanceSubItems.filter(item => showSalesMenus || !item.salesOnly);
  const hasTeam = ['sales_manager', 'supervisor'].includes(orgRole);
  const isAdmin = ['super_admin', 'admin'].includes(systemRole);
  const isStaffOrAbove = ['super_admin', 'admin', 'staff'].includes(systemRole);
  const isSuperAdmin = systemRole === 'super_admin';
  const isMyPerfActive = location.pathname.startsWith('/my-performance');
  const isMasterDataActive = ['/accounts', '/users', '/product-master'].includes(location.pathname);

  const masterDataSubItems = allMasterDataSubItems.filter(item => {
    if (item.minRole === 'super_admin') return isSuperAdmin;
    return true;
  });

  const visibleNav = navItems.filter(item => {
    if (item.url === '/team-performance' && !hasTeam) return false;
    return true;
  });

  // Split nav: Dashboard first, then My Performance collapsible, then rest
  const dashboardItem = visibleNav.find(i => i.url === '/');
  const restNav = visibleNav.filter(i => i.url !== '/');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight" style={{ color: 'hsl(174, 60%, 50%)' }}>
              KEMIKA SalesPulse
            </h1>
            <p className="text-[9px] text-sidebar-muted mt-0.5 whitespace-nowrap">Sales Performance Control System Dashboard</p>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <span className="text-lg font-bold" style={{ color: 'hsl(174, 60%, 50%)' }}>KS</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard */}
              {dashboardItem && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={dashboardItem.url}
                      end
                      className="hover:bg-sidebar-accent/50 text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <dashboardItem.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{dashboardItem.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* My Performance — collapsible */}
              <SidebarMenuItem>
                <Collapsible defaultOpen={isMyPerfActive}>
                  <CollapsibleTrigger className={`flex items-center w-full gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/50 text-sidebar-foreground ${isMyPerfActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                    <User className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">My Performance</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                      </>
                    )}
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenu className="ml-4 mt-0.5 border-l border-sidebar-border pl-2">
                        {myPerformanceSubItems.map((sub) => (
                          <SidebarMenuItem key={sub.title}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={sub.url}
                                end
                                className="hover:bg-sidebar-accent/50 text-sidebar-foreground text-xs"
                                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              >
                                <sub.icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                <span>{sub.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              </SidebarMenuItem>

              {/* Rest of nav */}
              {restNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent/50 text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isStaffOrAbove && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest">System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Master Data Management — collapsible */}
                <SidebarMenuItem>
                  <Collapsible defaultOpen={isMasterDataActive}>
                    <CollapsibleTrigger className={`flex items-center w-full gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/50 text-sidebar-foreground ${isMasterDataActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                      <Database className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">Master Data</span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                        </>
                      )}
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent>
                        <SidebarMenu className="ml-4 mt-0.5 border-l border-sidebar-border pl-2">
                          {masterDataSubItems.map((sub) => (
                            <SidebarMenuItem key={sub.title}>
                              <SidebarMenuButton asChild>
                                <NavLink
                                  to={sub.url}
                                  end
                                  className="hover:bg-sidebar-accent/50 text-sidebar-foreground text-xs"
                                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                >
                                  <sub.icon className="mr-2 h-3.5 w-3.5 shrink-0" />
                                  <span>{sub.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </SidebarMenuItem>

                {/* Admin items — filtered by role */}
                {isAdmin && adminItems
                  .filter(item => !item.superOnly || isSuperAdmin)
                  .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50 text-sidebar-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

    </Sidebar>
  );
}
