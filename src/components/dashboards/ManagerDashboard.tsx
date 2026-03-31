import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { useAppContext } from '@/context/AppContext';
import { formatIDR, formatIDRFull, formatPercent, getAchievementStatus } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Target, Percent, CreditCard, TrendingUp, BarChart3, Package, Layers, Building2, Loader2, Banknote, MapPin } from 'lucide-react';
import { SalesRevenueRanking } from './SalesRevenueRanking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

interface ProductWithCategory {
  name: string;
  category: string;
  revenue: number;
  units_sold: number;
}

interface CategoryRevenue {
  category: string;
  revenue: number;
}

export function ManagerDashboard() {
  const [topProducts, setTopProducts] = useState<ProductWithCategory[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryRevenue[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loading, setLoading] = useState(true);

  // Real DB state
  const [revenueMTD, setRevenueMTD] = useState(0);
  const [revenueYTD, setRevenueYTD] = useState(0);
  const [grossProfitMTD, setGrossProfitMTD] = useState(0);
  const [totalTarget, setTotalTarget] = useState(0);
  const [outstandingAR, setOutstandingAR] = useState(0);
  const [pipeline30, setPipeline30] = useState(0);
  const [pipeline60, setPipeline60] = useState(0);
  const [weightedForecast, setWeightedForecast] = useState(0);
  const [segmentRevenue, setSegmentRevenue] = useState<{ segment: string; revenue: number }[]>([]);
  const [customerRevenue, setCustomerRevenue] = useState<{ name: string; segment: string; revenue: number }[]>([]);
  const [regionData, setRegionData] = useState<{ region: string; revenue: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; B2G: number; B2B: number; B2C: number }[]>([]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);

      const [{ data: invoices }, { data: deals }, { data: targets }, { data: accounts }] = await Promise.all([
        supabase.from('invoices').select('net_sales, gross_profit, issue_date, due_date, paid_date, segment, account_id'),
        supabase.from('deals').select('value, probability, expected_close_date, stage'),
        supabase.from('targets').select('revenue_target'),
        supabase.from('accounts').select('id, name, segment, region'),
      ]);

      const allInvoices = invoices || [];
      const allDeals = deals || [];
      const allTargets = targets || [];
      const allAccounts = accounts || [];

      // MTD invoices
      const mtd = allInvoices.filter(i => {
        const d = new Date(i.issue_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      const mtdRev = mtd.reduce((s, i) => s + Number(i.net_sales), 0);
      const mtdGP = mtd.reduce((s, i) => s + Number(i.gross_profit), 0);
      setRevenueMTD(mtdRev);
      setGrossProfitMTD(mtdGP);

      // YTD
      const ytd = allInvoices.filter(i => new Date(i.issue_date).getFullYear() === currentYear);
      setRevenueYTD(ytd.reduce((s, i) => s + Number(i.net_sales), 0));

      // Targets
      setTotalTarget(allTargets.reduce((s, t) => s + Number(t.revenue_target), 0));

      // Outstanding AR
      setOutstandingAR(allInvoices.filter(inv => !inv.paid_date).reduce((s, inv) => s + Number(inv.net_sales), 0));

      // Pipeline
      const openDeals = allDeals.filter(d => !['closed_won', 'closed_lost', 'canceled', 'lost'].includes(d.stage));
      const now30 = Date.now() + 30 * 86400000;
      const now60 = Date.now() + 60 * 86400000;
      setPipeline30(openDeals.filter(d => new Date(d.expected_close_date).getTime() <= now30).reduce((s, d) => s + Number(d.value), 0));
      setPipeline60(openDeals.filter(d => { const t = new Date(d.expected_close_date).getTime(); return t > now30 && t <= now60; }).reduce((s, d) => s + Number(d.value), 0));
      setWeightedForecast(openDeals.reduce((s, d) => s + Number(d.value) * Number(d.probability) / 100, 0));

      // Segment revenue
      const totalRev = allInvoices.reduce((s, i) => s + Number(i.net_sales), 0);
      const segments = ['B2G', 'B2B', 'B2C'];
      setSegmentRevenue(segments.map(seg => ({
        segment: seg,
        revenue: allInvoices.filter(i => i.segment === seg).reduce((s, i) => s + Number(i.net_sales), 0),
      })));

      // Top 10 Customer
      const accountMap = new Map(allAccounts.map(a => [a.id, a]));
      const custRevMap = new Map<string, number>();
      allInvoices.forEach(inv => {
        custRevMap.set(inv.account_id, (custRevMap.get(inv.account_id) || 0) + Number(inv.net_sales));
      });
      const custRev = Array.from(custRevMap, ([accId, rev]) => {
        const acc = accountMap.get(accId);
        return { name: acc?.name || accId, segment: acc?.segment || '—', revenue: rev };
      }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      setCustomerRevenue(custRev);

      // Region distribution
      const regMap = new Map<string, number>();
      allInvoices.forEach(inv => {
        const acc = accountMap.get(inv.account_id);
        const region = acc?.region || 'Unknown';
        if (region) regMap.set(region, (regMap.get(region) || 0) + Number(inv.net_sales));
      });
      setRegionData(Array.from(regMap, ([region, revenue]) => ({ region, revenue })).filter(r => r.region && r.region !== '').sort((a, b) => b.revenue - a.revenue));

      // Monthly trend by segment
      const monthMap = new Map<string, { B2G: number; B2B: number; B2C: number }>();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      allInvoices.forEach(inv => {
        const d = new Date(inv.issue_date);
        if (d.getFullYear() === currentYear) {
          const key = monthNames[d.getMonth()];
          const entry = monthMap.get(key) || { B2G: 0, B2B: 0, B2C: 0 };
          const seg = inv.segment as 'B2G' | 'B2B' | 'B2C';
          if (seg in entry) entry[seg] += Number(inv.net_sales) / 1_000_000;
          monthMap.set(key, entry);
        }
      });
      const trend = monthNames.slice(0, currentMonth + 1).map(m => ({
        month: m,
        ...(monthMap.get(m) || { B2G: 0, B2B: 0, B2C: 0 }),
      }));
      setMonthlyTrend(trend);

      setLoading(false);
    }
    fetchDashboardData();
  }, []);

  // Fetch products from database
  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true);
      const { data: salesData } = await supabase
        .from('product_sales')
        .select('product_id, revenue, units_sold, products(name, category_id, product_categories(name))')
        .order('revenue', { ascending: false })
        .limit(10);

      if (salesData) {
        const products: ProductWithCategory[] = salesData.map((s: any) => ({
          name: s.products?.name ?? '—',
          category: s.products?.product_categories?.name ?? '—',
          revenue: Number(s.revenue),
          units_sold: s.units_sold,
        }));
        setTopProducts(products);

        const catMap = new Map<string, number>();
        salesData.forEach((s: any) => {
          const cat = s.products?.product_categories?.name ?? 'Uncategorized';
          catMap.set(cat, (catMap.get(cat) || 0) + Number(s.revenue));
        });
        setCategoryData(Array.from(catMap, ([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue));
      }
      setLoadingProducts(false);
    }
    fetchProducts();
  }, []);

  const totalRevenue = segmentRevenue.reduce((s, sr) => s + sr.revenue, 0);
  const marginPct = revenueMTD > 0 ? (grossProfitMTD / revenueMTD) * 100 : 0;
  const achievementPct = totalTarget > 0 ? (revenueMTD / totalTarget) * 100 : 0;

  const CATEGORY_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];
  const totalCategoryRevenue = categoryData.reduce((s, c) => s + c.revenue, 0);
  const REGION_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
  const totalRegionRevenue = regionData.reduce((s, r) => s + r.revenue, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Executive Summary</h2>
        <p className="text-sm text-muted-foreground">Company-wide sales performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Actual Revenue YTD" value={formatIDRFull(revenueYTD)} icon={Banknote} status={achievementPct >= 100 ? 'green' : achievementPct >= 80 ? 'yellow' : 'red'} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" />
        <KPICard label="Total Revenue MTD" value={formatIDRFull(revenueMTD)} icon={DollarSign} autoFitText className="bg-kpi-teal " borderAccent="border-l-kpi-teal-border" />
        <KPICard label="Total Target" value={formatIDRFull(totalTarget)} icon={Target} autoFitText className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" />
        <KPICard label="Target Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} autoFitText className="bg-kpi-purple " borderAccent="border-l-kpi-purple-border" />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} autoFitText className="bg-kpi-emerald " borderAccent="border-l-kpi-emerald-border" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Pipeline 30 Days" value={formatIDRFull(pipeline30)} icon={TrendingUp} autoFitText className="bg-kpi-indigo " borderAccent="border-l-kpi-indigo-border" />
        <KPICard label="Pipeline 60 Days" value={formatIDRFull(pipeline60)} icon={TrendingUp} autoFitText className="bg-kpi-orange " borderAccent="border-l-kpi-orange-border" />
        <KPICard label="Outstanding AR" value={formatIDRFull(outstandingAR)} icon={CreditCard} autoFitText className="bg-kpi-rose " borderAccent="border-l-kpi-rose-border" />
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} icon={BarChart3} autoFitText className="bg-kpi-cyan " borderAccent="border-l-kpi-cyan-border" />
      </div>

      {/* Revenue by Segment + Revenue Trend side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {segmentRevenue.map(s => {
                const pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={s.segment}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{s.segment}</span>
                      <span className="text-muted-foreground">{formatIDR(s.revenue)} ({formatPercent(pct)})</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Trend by Segment (in Millions)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="B2G" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="B2B" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="B2C" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Sales Revenue Ranking MTD & YTD */}
      <SalesRevenueRanking />

      {/* Top 10 Customer + Top 10 Produk side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" />
              Top 10 Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerRevenue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada data customer.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Segment</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Kontribusi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerRevenue.map((c, i) => {
                    const pct = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
                    return (
                      <TableRow key={c.name}>
                        <TableCell className="text-xs font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.segment}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{formatIDR(c.revenue)}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">{formatPercent(pct)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-accent" />
              Top 10 Produk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada data produk.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">Produk</TableHead>
                    <TableHead className="text-xs">Kategori</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={p.name + i}>
                      <TableCell className="text-xs font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.category}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">{formatIDR(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kategori Produk — Donut + Region side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              Kategori Produk — Donut
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada data kategori.</p>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="revenue" nameKey="category" paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={2}>
                      {categoryData.map((_, idx) => (
                        <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatIDR(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 w-full">
                  {categoryData.map((c, idx) => {
                    const pct = totalCategoryRevenue > 0 ? (c.revenue / totalCategoryRevenue) * 100 : 0;
                    return (
                      <div key={c.category} className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }} />
                        <span className="truncate">{c.category}</span>
                        <span className="ml-auto font-semibold text-muted-foreground">{formatPercent(pct)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              Revenue Distributed by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            {regionData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Belum ada data region.</p>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={regionData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatIDR(v)} />
                    <YAxis type="category" dataKey="region" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={100} />
                    <Tooltip formatter={(value: number) => {
                      const pct = totalRegionRevenue > 0 ? (Number(value) / totalRegionRevenue) * 100 : 0;
                      return [`${formatIDR(Number(value))} (${formatPercent(pct)})`, 'Revenue'];
                    }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {regionData.map((_, idx) => (
                        <Cell key={idx} fill={REGION_COLORS[idx % REGION_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 w-full">
                  {regionData.map((r, idx) => {
                    const pct = totalRegionRevenue > 0 ? (r.revenue / totalRegionRevenue) * 100 : 0;
                    return (
                      <div key={r.region} className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: REGION_COLORS[idx % REGION_COLORS.length] }} />
                        <span className="truncate">{r.region}</span>
                        <span className="ml-auto font-semibold text-muted-foreground">{formatPercent(pct)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
