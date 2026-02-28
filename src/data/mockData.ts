import { User, Target, Deal, Invoice, Account, SalesActivity, CoachingNote } from '@/types/sales';

// ---- USERS ----
export const mockUsers: User[] = [
  { id: 'u1', name: 'Budi Santoso', email: 'budi@company.com', orgRole: 'sales_manager', systemRole: 'super_admin', segment: 'B2B', region: 'Jabodetabek' },
  { id: 'u2', name: 'Siti Rahma', email: 'siti@company.com', orgRole: 'supervisor', systemRole: 'admin', segment: 'B2G', region: 'Jabodetabek', supervisorId: 'u1' },
  { id: 'u3', name: 'Andi Wijaya', email: 'andi@company.com', orgRole: 'supervisor', systemRole: 'admin', segment: 'B2B', region: 'Jawa Barat', supervisorId: 'u1' },
  { id: 'u4', name: 'Dewi Lestari', email: 'dewi@company.com', orgRole: 'sales_person', systemRole: 'staff', segment: 'B2G', region: 'Jabodetabek', supervisorId: 'u2' },
  { id: 'u5', name: 'Rizky Pratama', email: 'rizky@company.com', orgRole: 'sales_person', systemRole: 'staff', segment: 'B2G', region: 'Jawa Timur', supervisorId: 'u2' },
  { id: 'u6', name: 'Ayu Maharani', email: 'ayu@company.com', orgRole: 'sales_person', systemRole: 'staff', segment: 'B2B', region: 'Jawa Barat', supervisorId: 'u3' },
  { id: 'u7', name: 'Fajar Hidayat', email: 'fajar@company.com', orgRole: 'sales_person', systemRole: 'staff', segment: 'B2B', region: 'Jabodetabek', supervisorId: 'u3' },
  { id: 'u8', name: 'Nina Putri', email: 'nina@company.com', orgRole: 'sales_person', systemRole: 'staff', segment: 'B2C', region: 'Jabodetabek', supervisorId: 'u3' },
  { id: 'u9', name: 'Hendra Gunawan', email: 'hendra@company.com', orgRole: 'representative_management', systemRole: 'admin', segment: 'B2C', region: 'Nasional', supervisorId: 'u1' },
];

// ---- TARGETS ----
export const mockTargets: Target[] = [
  { id: 't1', userId: 'u4', segment: 'B2G', month: '2026-02', revenueTarget: 2_500_000_000, marginTarget: 20 },
  { id: 't2', userId: 'u5', segment: 'B2G', month: '2026-02', revenueTarget: 2_000_000_000, marginTarget: 18 },
  { id: 't3', userId: 'u6', segment: 'B2B', month: '2026-02', revenueTarget: 1_800_000_000, marginTarget: 22 },
  { id: 't4', userId: 'u7', segment: 'B2B', month: '2026-02', revenueTarget: 1_500_000_000, marginTarget: 20 },
  { id: 't5', userId: 'u8', segment: 'B2C', month: '2026-02', revenueTarget: 800_000_000, marginTarget: 25 },
];

// ---- ACCOUNTS ----
export const mockAccounts: Account[] = [
  { id: 'a1', name: 'Kementerian Kesehatan RI', segment: 'B2G', region: 'Jabodetabek', salesId: 'u4', type: 'Government' },
  { id: 'a2', name: 'Dinas Pendidikan Jatim', segment: 'B2G', region: 'Jawa Timur', salesId: 'u5', type: 'Government' },
  { id: 'a3', name: 'PT Astra International', segment: 'B2B', region: 'Jabodetabek', salesId: 'u7', type: 'Corporate' },
  { id: 'a4', name: 'PT Telkom Indonesia', segment: 'B2B', region: 'Jawa Barat', salesId: 'u6', type: 'Corporate' },
  { id: 'a5', name: 'PT Unilever Indonesia', segment: 'B2B', region: 'Jabodetabek', salesId: 'u7', type: 'Corporate' },
  { id: 'a6', name: 'Tokopedia Marketplace', segment: 'B2C', region: 'Jabodetabek', salesId: 'u8', type: 'E-Commerce' },
  { id: 'a7', name: 'Shopee Indonesia', segment: 'B2C', region: 'Jabodetabek', salesId: 'u8', type: 'E-Commerce' },
  { id: 'a8', name: 'RSUD Dr. Soetomo', segment: 'B2G', region: 'Jawa Timur', salesId: 'u5', type: 'Government' },
  { id: 'a9', name: 'PT Bank Mandiri', segment: 'B2B', region: 'Jabodetabek', salesId: 'u6', type: 'Corporate' },
];

// ---- DEALS ----
export const mockDeals: Deal[] = [
  { id: 'd1', accountId: 'a1', salesId: 'u4', name: 'Medical Equipment Tender 2026', segment: 'B2G', stage: 'negotiation', value: 1_200_000_000, probability: 75, expectedCloseDate: '2026-03-15', createdAt: '2026-01-10', updatedAt: '2026-02-20', daysInStage: 8 },
  { id: 'd2', accountId: 'a2', salesId: 'u5', name: 'School Lab Equipment', segment: 'B2G', stage: 'proposal', value: 800_000_000, probability: 50, expectedCloseDate: '2026-03-30', createdAt: '2026-01-20', updatedAt: '2026-02-15', daysInStage: 13 },
  { id: 'd3', accountId: 'a3', salesId: 'u7', name: 'Fleet Management System', segment: 'B2B', stage: 'qualification', value: 650_000_000, probability: 30, expectedCloseDate: '2026-04-20', createdAt: '2026-02-01', updatedAt: '2026-02-22', daysInStage: 6 },
  { id: 'd4', accountId: 'a4', salesId: 'u6', name: 'Network Infrastructure', segment: 'B2B', stage: 'closed_won', value: 950_000_000, probability: 100, expectedCloseDate: '2026-02-10', createdAt: '2025-12-05', updatedAt: '2026-02-10', daysInStage: 0 },
  { id: 'd5', accountId: 'a5', salesId: 'u7', name: 'Supply Chain Platform', segment: 'B2B', stage: 'negotiation', value: 420_000_000, probability: 60, expectedCloseDate: '2026-03-05', createdAt: '2026-01-15', updatedAt: '2026-02-25', daysInStage: 3 },
  { id: 'd6', accountId: 'a1', salesId: 'u4', name: 'Hospital IT System Phase 2', segment: 'B2G', stage: 'prospect', value: 2_100_000_000, probability: 15, expectedCloseDate: '2026-06-30', createdAt: '2026-02-20', updatedAt: '2026-02-20', daysInStage: 8 },
  { id: 'd7', accountId: 'a6', salesId: 'u8', name: 'Tokopedia Q2 Campaign', segment: 'B2C', stage: 'proposal', value: 350_000_000, probability: 55, expectedCloseDate: '2026-03-20', createdAt: '2026-02-05', updatedAt: '2026-02-18', daysInStage: 10 },
  { id: 'd8', accountId: 'a8', salesId: 'u5', name: 'Hospital Bed Procurement', segment: 'B2G', stage: 'closed_won', value: 600_000_000, probability: 100, expectedCloseDate: '2026-02-05', createdAt: '2025-11-15', updatedAt: '2026-02-05', daysInStage: 0 },
  { id: 'd9', accountId: 'a9', salesId: 'u6', name: 'Data Center Upgrade', segment: 'B2B', stage: 'negotiation', value: 1_100_000_000, probability: 70, expectedCloseDate: '2026-03-10', createdAt: '2026-01-08', updatedAt: '2026-02-26', daysInStage: 2 },
];

// ---- INVOICES ----
export const mockInvoices: Invoice[] = [
  { id: 'inv1', accountId: 'a4', salesId: 'u6', invoiceNumber: 'INV-2026-001', netSales: 950_000_000, grossProfit: 209_000_000, issueDate: '2026-02-12', dueDate: '2026-03-14', segment: 'B2B' },
  { id: 'inv2', accountId: 'a8', salesId: 'u5', invoiceNumber: 'INV-2026-002', netSales: 600_000_000, grossProfit: 108_000_000, issueDate: '2026-02-07', dueDate: '2026-03-09', segment: 'B2G' },
  { id: 'inv3', accountId: 'a1', salesId: 'u4', invoiceNumber: 'INV-2026-003', netSales: 1_450_000_000, grossProfit: 319_000_000, issueDate: '2026-01-15', dueDate: '2026-02-14', paidDate: '2026-02-10', segment: 'B2G' },
  { id: 'inv4', accountId: 'a3', salesId: 'u7', invoiceNumber: 'INV-2026-004', netSales: 380_000_000, grossProfit: 76_000_000, issueDate: '2026-02-20', dueDate: '2026-03-22', segment: 'B2B' },
  { id: 'inv5', accountId: 'a6', salesId: 'u8', invoiceNumber: 'INV-2026-005', netSales: 210_000_000, grossProfit: 63_000_000, issueDate: '2026-02-10', dueDate: '2026-03-12', segment: 'B2C' },
  { id: 'inv6', accountId: 'a7', salesId: 'u8', invoiceNumber: 'INV-2026-006', netSales: 175_000_000, grossProfit: 49_000_000, issueDate: '2026-02-18', dueDate: '2026-03-20', segment: 'B2C' },
  { id: 'inv7', accountId: 'a5', salesId: 'u7', invoiceNumber: 'INV-2026-007', netSales: 520_000_000, grossProfit: 109_200_000, issueDate: '2026-01-25', dueDate: '2026-02-24', segment: 'B2B' },
  { id: 'inv8', accountId: 'a2', salesId: 'u5', invoiceNumber: 'INV-2026-008', netSales: 450_000_000, grossProfit: 81_000_000, issueDate: '2026-01-20', dueDate: '2026-02-19', paidDate: '2026-02-18', segment: 'B2G' },
  { id: 'inv9', accountId: 'a9', salesId: 'u6', invoiceNumber: 'INV-2026-009', netSales: 280_000_000, grossProfit: 58_800_000, issueDate: '2026-02-25', dueDate: '2026-03-27', segment: 'B2B' },
];

// ---- ACTIVITIES ----
export const mockActivities: SalesActivity[] = [
  { id: 'act1', salesId: 'u4', type: 'meeting', date: '2026-02-26', accountId: 'a1', notes: 'Discussed Phase 2 requirements' },
  { id: 'act2', salesId: 'u4', type: 'call', date: '2026-02-25', accountId: 'a1', notes: 'Follow up on tender timeline' },
  { id: 'act3', salesId: 'u5', type: 'visit', date: '2026-02-24', accountId: 'a2', notes: 'Site survey for lab equipment' },
  { id: 'act4', salesId: 'u6', type: 'proposal', date: '2026-02-26', accountId: 'a9', notes: 'Submitted data center proposal' },
  { id: 'act5', salesId: 'u7', type: 'meeting', date: '2026-02-25', accountId: 'a3', notes: 'Fleet system demo presentation' },
  { id: 'act6', salesId: 'u7', type: 'email', date: '2026-02-24', accountId: 'a5', notes: 'Sent revised pricing' },
  { id: 'act7', salesId: 'u8', type: 'call', date: '2026-02-26', accountId: 'a6', notes: 'Campaign planning discussion' },
  { id: 'act8', salesId: 'u4', type: 'visit', date: '2026-02-23', accountId: 'a1', notes: 'Hospital facility tour' },
  { id: 'act9', salesId: 'u5', type: 'meeting', date: '2026-02-22', accountId: 'a8', notes: 'Invoice review meeting' },
  { id: 'act10', salesId: 'u6', type: 'call', date: '2026-02-21', accountId: 'a4', notes: 'Post-deployment check-in' },
];

// ---- COACHING NOTES ----
export const mockCoachingNotes: CoachingNote[] = [
  { id: 'cn1', salesId: 'u4', supervisorId: 'u2', date: '2026-02-20', note: 'Strong pipeline management. Focus on margin compliance for next tender.' },
  { id: 'cn2', salesId: 'u5', supervisorId: 'u2', date: '2026-02-18', note: 'Need to increase weekly activity count. Good relationship building skills.' },
  { id: 'cn3', salesId: 'u6', supervisorId: 'u3', date: '2026-02-22', note: 'Excellent Q1 close rate. Work on expanding account base in Jawa Barat.' },
];

// Revenue trend data for charts
export const monthlyRevenueData = [
  { month: 'Sep', B2G: 1800, B2B: 2200, B2C: 600 },
  { month: 'Oct', B2G: 2100, B2B: 1900, B2C: 750 },
  { month: 'Nov', B2G: 1600, B2B: 2500, B2C: 680 },
  { month: 'Dec', B2G: 2800, B2B: 3100, B2C: 920 },
  { month: 'Jan', B2G: 2050, B2B: 2300, B2C: 550 },
  { month: 'Feb', B2G: 2500, B2B: 2130, B2C: 385 },
];

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
