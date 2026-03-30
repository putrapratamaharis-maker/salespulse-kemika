// System types for Sales Performance Control System

export type SystemRole = 'super_admin' | 'admin' | 'staff' | 'viewer';
export type OrgRole = 'sales_manager' | 'supervisor' | 'sales_person' | 'representative_management';
export type Segment = 'B2G' | 'B2B' | 'B2C';
export type DealStage = 'prospect' | 'quotation' | 'negotiation' | 'po_secured' | 'invoice_issued' | 'canceled' | 'lost';

export interface DealProduct {
  id: string;
  category: string;
  productName: string;
  unit: string;
  qty: number;
  pricePerUnit: number;
  otherCost: number;
}

export type DateRange = 'MTD' | 'QTD' | 'YTD' | 'custom';

export interface User {
  id: string;
  name: string;
  email: string;
  orgRole: OrgRole;
  systemRole: SystemRole;
  segment: Segment;
  region: string;
  supervisorId?: string;
  avatar?: string;
}

export interface Target {
  id: string;
  userId: string;
  segment: Segment;
  month: string; // YYYY-MM
  revenueTarget: number;
  marginTarget: number;
}

export interface Deal {
  id: string;
  accountId: string;
  salesId: string;
  name: string;
  segment: Segment;
  stage: DealStage;
  value: number;
  probability: number;
  expectedCloseDate: string;
  createdAt: string;
  updatedAt: string;
  daysInStage: number;
  location?: string;
  notes?: string;
  expectedMargin?: number;
  products?: DealProduct[];
  poNumber?: string;
}


export interface Invoice {
  id: string;
  accountId: string;
  salesId: string;
  invoiceNumber: string;
  netSales: number;
  grossProfit: number;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  segment: Segment;
}

export interface Account {
  id: string;
  name: string;
  segment: Segment;
  region: string;
  salesId: string;
  type: string;
  picContact?: string;
  picEmail?: string;
}


export interface SalesActivity {
  id: string;
  salesId: string;
  type: 'call' | 'meeting' | 'email' | 'visit' | 'proposal';
  date: string;
  accountId: string;
  notes: string;
}

export interface KPICard {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  status?: 'green' | 'yellow' | 'red';
  icon?: string;
}

export interface CoachingNote {
  id: string;
  salesId: string;
  supervisorId: string;
  date: string;
  note: string;
}

export function formatIDRFull(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function formatIDR(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Jt`;
  }
  if (value >= 1_000) {
    return `Rp ${(value / 1_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Rb`;
  }
  return `Rp ${value.toLocaleString('id-ID')}`;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function getAchievementStatus(pct: number): 'green' | 'yellow' | 'red' {
  if (pct >= 100) return 'green';
  if (pct >= 80) return 'yellow';
  return 'red';
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
