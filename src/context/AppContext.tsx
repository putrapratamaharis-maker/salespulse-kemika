import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, OrgRole, SystemRole, Segment, DateRange } from '@/types/sales';
import { useAuth } from '@/context/AuthContext';

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  segmentFilter: Segment | 'All';
  setSegmentFilter: (seg: Segment | 'All') => void;
  users: User[];
}

const AppContext = createContext<AppContextType | null>(null);

const defaultUser: User = {
  id: '',
  name: '',
  email: '',
  orgRole: 'sales_person',
  systemRole: 'viewer',
  segment: 'B2B',
  region: '',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { profile, userRole, user } = useAuth();

  const buildUser = (): User => {
    if (!profile || !userRole || !user) return defaultUser;
    return {
      id: user.id,
      name: profile.full_name || '',
      email: profile.email || '',
      orgRole: (userRole.org_role as OrgRole) || 'sales_person',
      systemRole: (userRole.system_role as SystemRole) || 'viewer',
      segment: (profile.segment as Segment) || 'B2B',
      region: profile.region || '',
    };
  };

  const [currentUser, setCurrentUser] = useState<User>(buildUser);
  const [dateRange, setDateRange] = useState<DateRange>('MTD');
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'All'>('All');

  useEffect(() => {
    setCurrentUser(buildUser());
  }, [profile, userRole, user]);

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      dateRange,
      setDateRange,
      segmentFilter,
      setSegmentFilter,
      users: [],
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    return {
      currentUser: defaultUser,
      setCurrentUser: () => {},
      dateRange: 'MTD' as const,
      setDateRange: () => {},
      segmentFilter: 'All' as const,
      setSegmentFilter: () => {},
      users: [],
    } as AppContextType;
  }
  return ctx;
}
