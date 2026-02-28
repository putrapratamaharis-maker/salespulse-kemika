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
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
