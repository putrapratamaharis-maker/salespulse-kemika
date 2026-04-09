import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { formatIDRFull, formatPercent } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, ShoppingCart, TrendingUp, BarChart3, RefreshCw, DollarSign, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface SegmentData {
  revenueYTD: number;
  revenue: number;
  grossProfit: number;
  marginPct: number;
  avgDealSize: number;
  conversionRate: number;
}

interface MonthlyMovement {
  month: string;
  realisasi: number;
  target: number;
}

function SegmentKPIs({ segment, data }: { segment: 'B2G' | 'B2B' | 'B2C'; data: SegmentData }) {
  const { revenueYTD, revenue, grossProfit, marginPct, avgDealSize, conversionRate } = data;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KPICard label="Revenue YTD" value={formatIDRFull(revenueYTD)} icon={TrendingUp} autoFitText className="bg-kpi-teal" borderAccent="border-l-kpi-teal-border" tooltip="Total net_sales dari invoice segment ini di tahun berjalan" />
      <KPICard label="Revenue MTD" value={formatIDRFull(revenue)} icon={DollarSign} autoFitText className="bg-kpi-blue" borderAccent="border-l-kpi-blue-border" tooltip="Total net_sales dari invoice segment ini di bulan berjalan" />
      <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={BarChart3} autoFitText className="bg-kpi-amber" borderAccent="border-l-kpi-amber-border" tooltip="Gross Profit ÷ Revenue × 100%. Threshold hijau ≥ 17%" />
      <KPICard label="Avg Deal Size" value={formatIDRFull(avgDealSize)} icon={ShoppingCart} autoFitText className="bg-kpi-purple" borderAccent="border-l-kpi-purple-border" tooltip="Total nilai deal ÷ Jumlah deal pada segment ini" />
      <KPICard label="Conversion Rate" value={formatPercent(conversionRate)} status={conversionRate >= 50 ? 'green' : 'yellow'} icon={TrendingUp} autoFitText className="bg-kpi-rose" borderAccent="border-l-kpi-rose-border" tooltip="Jumlah deal Won ÷ Total deal aktif × 100%" />
      <KPICard label="Gross Profit" value={formatIDRFull(grossProfit)} icon={RefreshCw} autoFitText className="bg-kpi-emerald" borderAccent="border-l-kpi-emerald-border" tooltip="Total gross_profit dari invoice segment ini di bulan berjalan" />
    </div>
  );
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function RevenueMovementChart({ data }: { data: MonthlyMovement[] }) {
  const totalRealisasi = data.reduce((s, d) => s + d.realisasi, 0);
  const totalTarget = data.reduce((s, d) => s + d.target, 0);
  const achievementPct = totalTarget > 0 ? (totalRealisasi / totalTarget) * 100 : 0;
  const avgMonthlyTarget = totalTarget > 0 ? totalTarget / data.filter(d => d.target > 0).length : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">Revenue Movement Annual</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Realisasi vs Target per bulan (tahun berjalan)</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">YTD Realisasi:</span>
              <span className="font-bold text-foreground">{formatIDRFull(totalRealisasi)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">YTD Target:</span>
              <span className="font-bold text-foreground">{formatIDRFull(totalTarget)}</span>
            </div>
            <div className={`px-2 py-0.5 rounded-full font-bold ${
              achievementPct >= 100 ? 'bg-emerald-500/15 text-emerald-600' :
              achievementPct >= 80 ? 'bg-amber-500/15 text-amber-600' :
              'bg-red-500/15 text-red-600'
            }`}>
              {achievementPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => {
                  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}Jt`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}Rb`;
                  return v;
                }}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatIDRFull(value),
                  name === 'target' ? 'Target' : 'Realisasi'
                ]}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  fontSize: '12px',
                }}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-foreground">
                    {value === 'target' ? 'Target' : 'Realisasi'}
                  </span>
                )}
              />
              {avgMonthlyTarget > 0 && (
                <ReferenceLine
                  y={avgMonthlyTarget}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: 'Avg Target', position: 'right', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
              )}
              <Bar
                dataKey="target"
                fill="hsl(var(--muted-foreground) / 0.25)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="realisasi"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function computeSegment(mtdInvoices: any[], ytdInvoices: any[], deals: any[]): SegmentData {
  const revenue = mtdInvoices.reduce((s: number, i: any) => s + (i.net_sales || 0), 0);
  const revenueYTD = ytdInvoices.reduce((s: number, i: any) => s + (i.net_sales || 0), 0);
  const grossProfit = mtdInvoices.reduce((s: number, i: any) => s + (i.gross_profit || 0), 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const closedWon = deals.filter((d: any) => d.stage === 'po_secured').length;
  const avgDealSize = closedWon > 0 ? deals.filter((d: any) => d.stage === 'po_secured').reduce((s: number, d: any) => s + d.value, 0) / closedWon : 0;
  const paidInvoices = ytdInvoices.filter((i: any) => i.paid_date).length;
  const conversionRate = ytdInvoices.length > 0 ? (paidInvoices / ytdInvoices.length) * 100 : 0;
  return { revenueYTD, revenue, grossProfit, marginPct, avgDealSize, conversionRate };
}

function buildMovementData(
  invoices: any[],
  targets: any[],
  segment: string,
  year: number
): MonthlyMovement[] {
  return MONTH_LABELS.map((label, idx) => {
    const month = idx + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // Realisasi = net_sales from invoices in this segment & month
    const realisasi = invoices
      .filter((inv: any) => inv.segment === segment && inv.issue_date?.startsWith(monthStr))
      .reduce((s: number, inv: any) => s + (inv.net_sales || 0), 0);

    // Target = revenue_target from targets table for this segment & month
    const target = targets
      .filter((t: any) => t.segment === segment && t.month === monthStr)
      .reduce((s: number, t: any) => s + (t.revenue_target || 0), 0);

    return { month: label, realisasi, target };
  });
}

const SegmentPerformance = () => {
  const [loading, setLoading] = useState(true);
  const [segmentData, setSegmentData] = useState<Record<string, SegmentData>>({});
  const [movementData, setMovementData] = useState<Record<string, MonthlyMovement[]>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const year = new Date().getFullYear();

      const [{ data: invoices }, { data: deals }, { data: targets }] = await Promise.all([
        supabase.from('invoices').select('net_sales, gross_profit, segment, paid_date, issue_date'),
        supabase.from('deals').select('value, stage, segment'),
        supabase.from('targets').select('revenue_target, segment, month'),
      ]);

      const now = new Date();
      const currentMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const yearStr = `${year}`;

      const result: Record<string, SegmentData> = {};
      const movement: Record<string, MonthlyMovement[]> = {};

      for (const seg of ['B2G', 'B2B', 'B2C']) {
        const allSegInv = (invoices || []).filter((i: any) => i.segment === seg);
        const ytdInv = allSegInv.filter((i: any) => i.issue_date?.startsWith(yearStr));
        const mtdInv = allSegInv.filter((i: any) => i.issue_date?.startsWith(currentMonth));
        const segDeals = (deals || []).filter((d: any) => d.segment === seg);
        result[seg] = computeSegment(mtdInv, ytdInv, segDeals);
        movement[seg] = buildMovementData(invoices || [], targets || [], seg, year);
      }

      setSegmentData(result);
      setMovementData(movement);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const emptySegment: SegmentData = { revenue: 0, grossProfit: 0, marginPct: 0, winRate: 0, avgDealSize: 0, conversionRate: 0 };
  const emptyMovement: MonthlyMovement[] = MONTH_LABELS.map(m => ({ month: m, realisasi: 0, target: 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Segment Performance</h2>
        <p className="text-sm text-muted-foreground">KPIs customized per business segment</p>
      </div>

      <Tabs defaultValue="B2G">
        <TabsList>
          <TabsTrigger value="B2G">B2G (Government)</TabsTrigger>
          <TabsTrigger value="B2B">B2B (Private)</TabsTrigger>
          <TabsTrigger value="B2C">B2C (E-Commerce)</TabsTrigger>
        </TabsList>
        {(['B2G', 'B2B', 'B2C'] as const).map(seg => (
          <TabsContent key={seg} value={seg} className="mt-4 space-y-4">
            <SegmentKPIs segment={seg} data={segmentData[seg] || emptySegment} />
            <RevenueMovementChart data={movementData[seg] || emptyMovement} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SegmentPerformance;
