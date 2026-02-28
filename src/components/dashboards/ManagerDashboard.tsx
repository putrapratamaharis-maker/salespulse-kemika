import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { useAppContext } from '@/context/AppContext';
import { formatIDR, formatPercent, getAchievementStatus } from '@/types/sales';
import { mockInvoices, mockDeals, mockTargets, monthlyRevenueData, mockAccounts } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Target, Percent, CreditCard, TrendingUp, BarChart3, Package, Layers, Building2, Loader2 } from 'lucide-react';
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

  // Existing mock data calculations
  const totalRevenue = mockInvoices.reduce((s, i) => s + i.netSales, 0);
  const totalGrossProfit = mockInvoices.reduce((s, i) => s + i.grossProfit, 0);
  const totalTarget = mockTargets.reduce((s, t) => s + t.revenueTarget, 0);
  const marginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  const achievementPct = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
  const outstandingAR = mockInvoices.filter(inv => !inv.paidDate).reduce((s, inv) => s + inv.netSales, 0);

  const openDeals = mockDeals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const pipeline30 = openDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).reduce((s, d) => s + d.value, 0);
  const pipeline60 = openDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 30 && days <= 60;
  }).reduce((s, d) => s + d.value, 0);
  const pipeline90 = openDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 60 && days <= 90;
  }).reduce((s, d) => s + d.value, 0);
  const weightedForecast = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);

  const segments = ['B2G', 'B2B', 'B2C'] as const;
  const segmentRevenue = segments.map(seg => ({
    segment: seg,
    revenue: mockInvoices.filter(i => i.segment === seg).reduce((s, i) => s + i.netSales, 0),
  }));

  // Top 10 Customer from mock data
  const customerRevenue = mockAccounts.map(acc => {
    const rev = mockInvoices.filter(inv => inv.accountId === acc.id).reduce((s, inv) => s + inv.netSales, 0);
    return { name: acc.name, segment: acc.segment, revenue: rev };
  }).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

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

        // Aggregate by category
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

  const CATEGORY_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];
  const totalCategoryRevenue = categoryData.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Executive Summary</h2>
        <p className="text-sm text-muted-foreground">Company-wide sales performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue MTD" value={formatIDR(totalRevenue)} change={14.2} changeLabel="vs last month" icon={DollarSign} />
        <KPICard label="Target Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} />
        <KPICard label="Outstanding AR" value={formatIDR(outstandingAR)} icon={CreditCard} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Pipeline 30 Days" value={formatIDR(pipeline30)} icon={TrendingUp} />
        <KPICard label="Pipeline 60 Days" value={formatIDR(pipeline60)} icon={TrendingUp} />
        <KPICard label="Pipeline 90 Days" value={formatIDR(pipeline90)} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard label="Weighted Forecast" value={formatIDR(weightedForecast)} change={8.5} changeLabel="reliability" icon={BarChart3} />
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
      </div>

      {/* Top 10 Customer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            Top 10 Customer
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Top 10 Products & Product Category — from database */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              Kategori Produk
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
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="revenue"
                      nameKey="category"
                      paddingAngle={3}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    >
                      {categoryData.map((_, idx) => (
                        <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatIDR(value)}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
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
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue Trend by Segment (in Millions)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="B2G" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="B2B" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="B2C" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
