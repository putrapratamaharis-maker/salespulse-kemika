import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { useNavigate } from 'react-router-dom';

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
  const { currentUser } = useAppContext();
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.full_name || currentUser.name;
  const displayEmail = profile?.email || currentUser.email;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="filter-bar sticky top-0 z-30">
      <SidebarTrigger className="mr-2" />

      <div className="flex items-center gap-1 mr-auto">
        <span className="font-semibold text-sm text-foreground">{displayName}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {orgRoleLabels[currentUser.orgRole]}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {systemRoleLabels[currentUser.systemRole]}
        </Badge>
      </div>

      <Button variant="ghost" size="icon" className="relative h-8 w-8">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
          3
        </span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors outline-none">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-xs font-medium text-foreground leading-tight">{displayName}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{displayEmail}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground leading-none">{displayEmail}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
