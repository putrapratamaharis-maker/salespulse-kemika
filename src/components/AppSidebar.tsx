import {
  LayoutDashboard, User, Users, PieChart, TrendingUp, DollarSign,
  Package, CreditCard, Settings, ChevronDown
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAppContext } from '@/context/AppContext';
import { mockUsers } from '@/data/mockData';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'My Performance', url: '/my-performance', icon: User },
  { title: 'Team Performance', url: '/team-performance', icon: Users },
  { title: 'Segment Performance', url: '/segment-performance', icon: PieChart },
  { title: 'Pipeline & Forecast', url: '/pipeline', icon: TrendingUp },
  { title: 'Revenue & Margin', url: '/revenue', icon: DollarSign },
  { title: 'Product Performance', url: '/products', icon: Package },
  { title: 'AR & Cashflow', url: '/ar-cashflow', icon: CreditCard },
];

const adminItems = [
  { title: 'Admin Panel', url: '/admin', icon: Settings },
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

  const hasTeam = ['sales_manager', 'supervisor'].includes(currentUser.orgRole);
  const isAdmin = ['super_admin', 'admin'].includes(currentUser.systemRole);

  const visibleNav = navItems.filter(item => {
    if (item.url === '/team-performance' && !hasTeam) return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight" style={{ color: 'hsl(174, 60%, 50%)' }}>
              SalesPulse
            </h1>
            <p className="text-xs text-sidebar-muted mt-0.5">Performance Control System</p>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center">
            <span className="text-lg font-bold" style={{ color: 'hsl(174, 60%, 50%)' }}>SP</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => (
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

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest">System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
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

      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="text-[10px] text-sidebar-muted uppercase tracking-widest mb-1.5">Demo: Switch Role</div>
          <Select value={currentUser.id} onValueChange={(id) => {
            const user = mockUsers.find(u => u.id === id);
            if (user) setCurrentUser(user);
          }}>
            <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mockUsers.map(u => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground ml-1">({orgRoleLabels[u.orgRole]})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
