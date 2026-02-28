import { useAppContext } from '@/context/AppContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter } from 'lucide-react';
import { DateRange, Segment } from '@/types/sales';

const orgRoleLabels: Record<string, string> = {
  sales_manager: 'Sales Manager',
  supervisor: 'Supervisor',
  sales_person: 'Sales Person',
  representative_management: 'Rep. Management',
};

const systemRoleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  viewer: 'Viewer',
};

export function TopBar() {
  const { currentUser, dateRange, setDateRange, segmentFilter, setSegmentFilter } = useAppContext();

  return (
    <header className="filter-bar sticky top-0 z-30">
      <SidebarTrigger className="mr-2" />

      <div className="flex items-center gap-1 mr-auto">
        <span className="font-semibold text-sm text-foreground">{currentUser.name}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {orgRoleLabels[currentUser.orgRole]}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {systemRoleLabels[currentUser.systemRole]}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-8 text-xs w-24 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MTD">MTD</SelectItem>
              <SelectItem value="QTD">QTD</SelectItem>
              <SelectItem value="YTD">YTD</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={segmentFilter} onValueChange={(v) => setSegmentFilter(v as Segment | 'All')}>
            <SelectTrigger className="h-8 text-xs w-24 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Segments</SelectItem>
              <SelectItem value="B2G">B2G</SelectItem>
              <SelectItem value="B2B">B2B</SelectItem>
              <SelectItem value="B2C">B2C</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
}
