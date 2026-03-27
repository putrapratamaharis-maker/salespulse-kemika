import { User, Target, Deal, Invoice, Account, SalesActivity, CoachingNote } from '@/types/sales';

// ---- USERS ----
export const mockUsers: User[] = [];

// ---- TARGETS ----
export const mockTargets: Target[] = [];

// ---- ACCOUNTS ----
export const mockAccounts: Account[] = [];

// ---- DEALS ----
export const mockDeals: Deal[] = [];

// ---- INVOICES ----
export const mockInvoices: Invoice[] = [];

// ---- ACTIVITIES ----
export const mockActivities: SalesActivity[] = [];

// ---- COACHING NOTES ----
export const mockCoachingNotes: CoachingNote[] = [];

// Revenue trend data for charts
export const monthlyRevenueData: { month: string; B2G: number; B2B: number; B2C: number }[] = [];

// Helper to get subordinates
export function getSubordinates(userId: string): User[] {
  return mockUsers.filter(u => u.supervisorId === userId);
}

// Helper to get all downstream user IDs
export function getAllDownstreamIds(userId: string): string[] {
  const direct = getSubordinates(userId);
  const ids: string[] = [];
  for (const u of direct) {
    ids.push(u.id);
    ids.push(...getAllDownstreamIds(u.id));
  }
  return ids;
}

export function getUserInvoices(userId: string): Invoice[] {
  return mockInvoices.filter(inv => inv.salesId === userId);
}

export function getUserDeals(userId: string): Deal[] {
  return mockDeals.filter(d => d.salesId === userId);
}

export function getUserTarget(userId: string): Target | undefined {
  return mockTargets.find(t => t.userId === userId);
}

export function getUserActivities(userId: string): SalesActivity[] {
  return mockActivities.filter(a => a.salesId === userId);
}
