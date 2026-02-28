import React, { createContext, useContext, useState } from 'react';
import { User, OrgRole, SystemRole, Segment, DateRange } from '@/types/sales';
import { mockUsers } from '@/data/mockData';

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(mockUsers[0]); // Sales Manager by default
  const [dateRange, setDateRange] = useState<DateRange>('MTD');
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'All'>('All');

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      dateRange,
      setDateRange,
      segmentFilter,
      setSegmentFilter,
      users: mockUsers,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    // During auth loading/redirect, context may not be available yet
    return {
      currentUser: { id: '', name: '', email: '', orgRole: 'sales_person' as const, systemRole: 'viewer' as const, segment: 'B2B' as const, region: '' },
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
