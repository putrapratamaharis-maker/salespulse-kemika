import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Loader2, TrendingUp, BarChart3, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ProductWithSales {
  id: string;
  name: string;
  category: string;
  totalRevenue: number;
  unitsSold: number;
  segments: string[];
}

const Products = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductWithSales[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: prods }, { data: sales }, { data: cats }] = await Promise.all([
        supabase.from('products').select('id, name, category_id').eq('is_active', true).order('name'),
        supabase.from('product_sales').select('product_id, revenue, units_sold, segment'),
        supabase.from('product_categories').select('id, name'),
      ]);

      const catMap = new Map((cats || []).map(c => [c.id, c.name]));
      const salesByProduct = new Map<string, { revenue: number; units: number; segments: Set<string> }>();

      (sales || []).forEach(s => {
        const existing = salesByProduct.get(s.product_id) || { revenue: 0, units: 0, segments: new Set<string>() };
        existing.revenue += Number(s.revenue) || 0;
        existing.units += Number(s.units_sold) || 0;
        if (s.segment) existing.segments.add(s.segment);
        salesByProduct.set(s.product_id, existing);
      });

      const merged: ProductWithSales[] = (prods || []).map(p => {
        const s = salesByProduct.get(p.id);
        return {
          id: p.id,
          name: p.name,
          category: catMap.get(p.category_id || '') || '—',
          totalRevenue: s?.revenue || 0,
          unitsSold: s?.units || 0,
          segments: s ? Array.from(s.segments) : [],
        };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue);

      setProducts(merged);
      setLoading(false);
    };
    fetchData();
  }, []);

  const formatIDR = (val: number) => {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`;
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const stats = useMemo(() => {
    const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
    const totalUnits = products.reduce((s, p) => s + p.unitsSold, 0);
    const categories = new Set(products.map(p => p.category).filter(c => c !== '—'));
    const withSales = products.filter(p => p.totalRevenue > 0).length;
    return { totalRevenue, totalUnits, categoryCount: categories.size, withSales };
  }, [products]);

  const maxRevenue = useMemo(() => Math.max(...products.map(p => p.totalRevenue), 1), [products]);

  const topProducts = useMemo(() => products.slice(0, 8), [products]);

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    topProducts.forEach((p, i) => {
      const colors = [
        'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
        'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
        'hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))',
      ];
      cfg[`product_${i}`] = { label: p.name, color: colors[i % colors.length] };
    });
    cfg.revenue = { label: 'Revenue', color: 'hsl(var(--accent))' };
    return cfg;
  }, [topProducts]);

  const chartData = useMemo(() =>
    topProducts.map((p, i) => ({
      name: p.name.length > 14 ? p.name.slice(0, 12) + '…' : p.name,
      fullName: p.name,
      revenue: p.totalRevenue,
      fill: chartConfig[`product_${i}`]?.color || 'hsl(var(--accent))',
    })),
    [topProducts, chartConfig]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Product Performance</h2>
        <p className="text-sm text-muted-foreground">Ringkasan performa penjualan per produk</p>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: formatIDR(stats.totalRevenue), icon: TrendingUp, accent: true },
          { label: 'Units Terjual', value: stats.totalUnits.toLocaleString(), icon: Package },
          { label: 'Produk Aktif', value: `${stats.withSales} / ${products.length}`, icon: BarChart3 },
          { label: 'Kategori', value: String(stats.categoryCount), icon: Layers },
        ].map((kpi, i) => (
          <Card key={i} className="animate-fade-in">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.accent ? 'bg-accent/10' : 'bg-secondary'}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.accent ? 'text-accent' : 'text-muted-foreground'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{kpi.label}</p>
                <p className={`text-lg font-bold tracking-tight ${kpi.accent ? 'text-accent' : 'text-foreground'}`}>{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Top Products */}
      {topProducts.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Produk by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/40" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatIDR(v)}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) => (
                        <span className="font-semibold">{formatIDR(Number(value))}</span>
                      )}
                      labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName || _label}
                    />
                  }
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Product Table */}
      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Detail Produk</CardTitle>
            <span className="text-xs text-muted-foreground">{products.length} produk</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Belum ada data produk.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6 w-[40px]">#</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="w-[160px]">Kontribusi</TableHead>
                    <TableHead>Segment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p, idx) => {
                    const pct = maxRevenue > 0 ? (p.totalRevenue / stats.totalRevenue) * 100 : 0;
                    return (
                      <TableRow key={p.id} className="group">
                        <TableCell className="pl-6 text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-normal">{p.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm tabular-nums">
                          {formatIDR(p.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {p.unitsSold.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-muted-foreground w-[36px] text-right tabular-nums">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.segments.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {p.segments.map(s => (
                                <Badge key={s} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Products;
