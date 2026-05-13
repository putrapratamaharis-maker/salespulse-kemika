import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatIDRFull, formatPercent } from '@/types/sales';
import { Users, Building2, Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface InvoiceRow {
  id: string;
  account_id: string;
  sales_id: string;
  segment: string;
  net_sales: number;
  gross_profit: number;
  issue_date: string;
}

interface DealRow {
  id: string;
  segment: string;
  stage: string;
  value: number;
  sales_id: string;
  expected_close_date: string;
}

interface DealProductRow {
  deal_id: string;
  product_name: string;
  qty: number;
  price_per_unit: number;
  other_cost: number;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
}

interface AccountRow {
  id: string;
  name: string;
}

interface SegmentDrilldownProps {
  segment: 'B2G' | 'B2B' | 'B2C';
  invoices: InvoiceRow[];
  deals: DealRow[];
  dealProducts: DealProductRow[];
  profiles: ProfileRow[];
  accounts: AccountRow[];
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const WON_STAGES = ['po_secured', 'invoice_issued'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_MONTHS: Record<string, number[]> = {
  Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12],
};

function formatAxisIDR(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(0)}Jt`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}Rb`;
  return String(v);
}

function growthBadge(pct: number | null) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (pct > 0)  return <Badge className="text-[10px] px-1.5 bg-green-100 text-green-700 border-0 gap-0.5"><TrendingUp className="h-2.5 w-2.5" />+{pct.toFixed(1)}%</Badge>;
  if (pct < 0)  return <Badge className="text-[10px] px-1.5 bg-red-100 text-red-700 border-0 gap-0.5"><TrendingDown className="h-2.5 w-2.5" />{pct.toFixed(1)}%</Badge>;
  return <Badge className="text-[10px] px-1.5 bg-muted text-muted-foreground border-0 gap-0.5"><Minus className="h-2.5 w-2.5" />0%</Badge>;
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export function SegmentDrilldown({
  segment, invoices, deals, dealProducts, profiles, accounts,
}: SegmentDrilldownProps) {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const previousYear = currentYear - 1;

  // Map lookups
  const profileMap  = useMemo(() => new Map(profiles.map(p => [p.user_id, p.full_name])), [profiles]);
  const accountMap  = useMemo(() => new Map(accounts.map(a => [a.id, a.name])), [accounts]);

  // Segment invoices
  const segInv = useMemo(() => invoices.filter(i => i.segment === segment), [invoices, segment]);
  const segInvCY = useMemo(() => segInv.filter(i => new Date(i.issue_date).getFullYear() === currentYear), [segInv, currentYear]);

  /* ── Top 5 Accounts ── */
  const topAccounts = useMemo(() => {
    const map: Record<string, number> = {};
    segInvCY.forEach(i => { map[i.account_id] = (map[i.account_id] || 0) + Number(i.net_sales); });
    return Object.entries(map)
      .map(([id, rev]) => ({ name: accountMap.get(id) || id, revenue: rev }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [segInvCY, accountMap]);

  /* ── Top 5 Salesperson ── */
  const topSales = useMemo(() => {
    const map: Record<string, number> = {};
    segInvCY.forEach(i => { map[i.sales_id] = (map[i.sales_id] || 0) + Number(i.net_sales); });
    return Object.entries(map)
      .map(([id, rev]) => ({ name: profileMap.get(id) || id, revenue: rev }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [segInvCY, profileMap]);

  /* ── Top 5 Products ── */
  const topProducts = useMemo(() => {
    const segWonDealIds = new Set(
      deals
        .filter(d => d.segment === segment && WON_STAGES.includes(d.stage) &&
          new Date(d.expected_close_date).getFullYear() === currentYear)
        .map(d => d.id)
    );
    const map: Record<string, number> = {};
    dealProducts.forEach(dp => {
      if (!segWonDealIds.has(dp.deal_id)) return;
      const lineTotal = Number(dp.qty) * Number(dp.price_per_unit) + Number(dp.other_cost);
      const key = dp.product_name || '(Tanpa Nama)';
      map[key] = (map[key] || 0) + lineTotal;
    });
    return Object.entries(map)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [deals, dealProducts, segment, currentYear]);

  /* ── Quarter-over-Quarter ── */
  const qoqData = useMemo(() => {
    return QUARTERS.map(q => {
      const months = QUARTER_MONTHS[q];
      const cyRev = segInv
        .filter(i => {
          const d = new Date(i.issue_date);
          return d.getFullYear() === currentYear && months.includes(d.getMonth() + 1);
        })
        .reduce((s, i) => s + Number(i.net_sales), 0);

      const pyRev = segInv
        .filter(i => {
          const d = new Date(i.issue_date);
          return d.getFullYear() === previousYear && months.includes(d.getMonth() + 1);
        })
        .reduce((s, i) => s + Number(i.net_sales), 0);

      const growth = pyRev > 0 ? ((cyRev - pyRev) / pyRev) * 100 : null;
      return { quarter: q, [currentYear]: cyRev, [previousYear]: pyRev, growth };
    });
  }, [segInv, currentYear, previousYear]);

  const totalCY = qoqData.reduce((s, d) => s + (d[currentYear] as number), 0);
  const totalPY = qoqData.reduce((s, d) => s + (d[previousYear] as number), 0);
  const totalGrowth = totalPY > 0 ? ((totalCY - totalPY) / totalPY) * 100 : null;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4 mt-2">
      {/* Quarter-over-Quarter Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Quarter-over-Quarter Revenue — {segment}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{currentYear} vs {previousYear}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">YTD {currentYear}: <strong className="text-foreground">{formatIDRFull(totalCY)}</strong></span>
              <span className="text-muted-foreground">YTD {previousYear}: <strong className="text-foreground">{formatIDRFull(totalPY)}</strong></span>
              {growthBadge(totalGrowth)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={qoqData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatAxisIDR} tick={{ fontSize: 10 }} width={50} />
              <Tooltip
                formatter={(val: number, name: string) => [formatIDRFull(val), `Revenue ${name}`]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={previousYear} fill="hsl(var(--muted-foreground) / 0.3)" radius={[3, 3, 0, 0]} maxBarSize={40} name={String(previousYear)} />
              <Bar dataKey={currentYear}  fill="hsl(var(--primary))"              radius={[3, 3, 0, 0]} maxBarSize={40} name={String(currentYear)} />
            </BarChart>
          </ResponsiveContainer>

          {/* Growth per quarter */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {qoqData.map(d => (
              <div key={d.quarter} className="text-center">
                <p className="text-xs font-semibold text-muted-foreground">{d.quarter}</p>
                <div className="mt-1">{growthBadge(d.growth as number | null)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top 5 Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Accounts */}
        <TopTable
          title="Top Account by Revenue"
          icon={<Building2 className="h-4 w-4 text-blue-500" />}
          rows={topAccounts}
          emptyMsg="Belum ada data invoice segment ini"
        />

        {/* Top Products */}
        <TopTable
          title="Top Produk by Revenue"
          icon={<Package className="h-4 w-4 text-purple-500" />}
          rows={topProducts}
          emptyMsg="Belum ada deal produk di segment ini"
        />

        {/* Top Salesperson */}
        <TopTable
          title="Top Salesperson by Revenue"
          icon={<Users className="h-4 w-4 text-green-500" />}
          rows={topSales}
          emptyMsg="Belum ada data penjualan di segment ini"
        />
      </div>
    </div>
  );
}

/* ── Shared Top-5 Table ─────────────────────────────────────────────────── */
function TopTable({
  title, icon, rows, emptyMsg,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { name: string; revenue: number }[];
  emptyMsg: string;
}) {
  const maxRev = rows[0]?.revenue || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">{emptyMsg}</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const pct = (row.revenue / maxRev) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                      <span className="text-xs font-medium truncate" title={row.name}>{row.name}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums shrink-0 text-right">
                      {formatIDRFull(row.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, opacity: 1 - idx * 0.12 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
