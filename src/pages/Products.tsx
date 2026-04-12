import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Loader2, TrendingUp, BarChart3, Layers, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityPagination } from '@/components/activities/ActivityPagination';

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
  const [categories, setCategories] = useState<string[]>([]);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [revenueFilter, setRevenueFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

      const uniqueCats = [...new Set(merged.map(p => p.category).filter(c => c !== '—'))].sort();
      setCategories(uniqueCats);
      setProducts(merged);
      setLoading(false);
    };
    fetchData();
  }, []);

  const formatIDRFull = (val: number) => {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`;
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const formatNumIDR = (val: number) => val.toLocaleString('id-ID');

  const stats = useMemo(() => {
    const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
    const totalUnits = products.reduce((s, p) => s + p.unitsSold, 0);
    const catCount = new Set(products.map(p => p.category).filter(c => c !== '—')).size;
    const withSales = products.filter(p => p.totalRevenue > 0).length;
    return { totalRevenue, totalUnits, categoryCount: catCount, withSales };
  }, [products]);

  const top10 = useMemo(() => products.slice(0, 10), [products]);
  const top10Max = useMemo(() => Math.max(...top10.map(p => p.totalRevenue), 1), [top10]);

  // Filtered products for table
  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }
    if (revenueFilter !== 'all') {
      const [min, max] = revenueFilter.split('-').map(Number);
      result = result.filter(p => p.totalRevenue >= min && (max > 0 ? p.totalRevenue <= max : true));
    }
    return result;
  }, [products, categoryFilter, revenueFilter]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [categoryFilter, revenueFilter]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Product Performance</h2>
        <p className="text-sm text-muted-foreground">Ringkasan performa penjualan per produk</p>
      </div>

      {/* KPI Cards — soft colored backgrounds */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="animate-fade-in border-0 border-l-[5px] border-l-kpi-blue-border bg-kpi-blue">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-kpi-blue-fg/10">
              <TrendingUp className="h-5 w-5 text-kpi-blue-fg" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-kpi-blue-fg/70">Total Revenue</p>
              <p className="text-lg font-bold tracking-tight text-kpi-blue-fg">{formatIDRFull(stats.totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in border-0 border-l-[5px] border-l-kpi-teal-border bg-kpi-teal">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-kpi-teal-fg/10">
              <Package className="h-5 w-5 text-kpi-teal-fg" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-kpi-teal-fg/70">Units Terjual</p>
              <p className="text-lg font-bold tracking-tight text-kpi-teal-fg">{stats.totalUnits.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in border-0 border-l-[5px] border-l-kpi-purple-border bg-kpi-purple">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-kpi-purple-fg/10">
              <BarChart3 className="h-5 w-5 text-kpi-purple-fg" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-kpi-purple-fg/70">Produk Aktif</p>
              <p className="text-lg font-bold tracking-tight text-kpi-purple-fg">{stats.withSales} / {products.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in border-0 border-l-[5px] border-l-kpi-amber-border bg-kpi-amber">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-kpi-amber-fg/10">
              <Layers className="h-5 w-5 text-kpi-amber-fg" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-kpi-amber-fg/70">Kategori</p>
              <p className="text-lg font-bold tracking-tight text-kpi-amber-fg">{stats.categoryCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Products Infographic */}
      {top10.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <CardTitle className="text-sm font-semibold">Top 10 Produk by Revenue</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {top10.map((p, idx) => {
              const pct = (p.totalRevenue / top10Max) * 100;
              const contributionPct = stats.totalRevenue > 0 ? (p.totalRevenue / stats.totalRevenue) * 100 : 0;
              return (
                <div key={p.id} className="flex items-center gap-3 group">
                  <div className="w-6 text-right">
                    {idx < 3 ? (
                      <Crown className={`h-4 w-4 inline ${medalColors[idx]}`} />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">{idx + 1}</span>
                    )}
                  </div>
                  <div className="w-[140px] truncate text-sm font-medium" title={p.name}>{p.name}</div>
                  <div className="flex-1 relative">
                    <div className="h-6 rounded-md bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-500"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          background: idx === 0
                            ? 'hsl(var(--primary))'
                            : idx === 1
                              ? 'hsl(var(--accent))'
                              : idx === 2
                                ? 'hsl(var(--chart-3))'
                                : 'hsl(var(--muted-foreground) / 0.35)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-[90px] text-right text-sm font-semibold tabular-nums">
                    {formatIDRFull(p.totalRevenue)}
                  </div>
                  <div className="w-[50px] text-right">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {contributionPct.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Product Detail Table */}
      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Detail Produk</CardTitle>
              <span className="text-xs text-muted-foreground">
                {filteredProducts.length !== products.length
                  ? `${filteredProducts.length} / ${products.length} produk`
                  : `${products.length} produk`}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={revenueFilter} onValueChange={setRevenueFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Range Revenue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Revenue</SelectItem>
                  <SelectItem value="1000000000-0">&gt; Rp 1B</SelectItem>
                  <SelectItem value="500000000-1000000000">Rp 500M – 1B</SelectItem>
                  <SelectItem value="100000000-500000000">Rp 100M – 500M</SelectItem>
                  <SelectItem value="10000000-100000000">Rp 10M – 100M</SelectItem>
                  <SelectItem value="0-10000000">&lt; Rp 10M</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Tidak ada produk yang cocok dengan filter.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6 w-[40px] text-xs text-white font-semibold bg-gradient-to-br from-slate-600 to-slate-500 rounded-tl-md py-3">#</TableHead>
                      <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-indigo-600 to-indigo-500 py-3">Produk</TableHead>
                      <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-sky-600 to-sky-500 py-3">Kategori</TableHead>
                      <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-emerald-600 to-emerald-500 py-3 text-right">Revenue (Rp)</TableHead>
                      <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-amber-500 to-amber-400 py-3 text-right">Units</TableHead>
                      <TableHead className="w-[160px] text-xs text-white font-semibold bg-gradient-to-br from-rose-500 to-rose-400 rounded-tr-md py-3">Kontribusi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((p, idx) => {
                      const pct = stats.totalRevenue > 0 ? (p.totalRevenue / stats.totalRevenue) * 100 : 0;
                      const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="pl-6 text-muted-foreground text-xs">{globalIdx}</TableCell>
                          <TableCell className="font-medium text-sm">{p.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] font-normal">{p.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm tabular-nums">
                            {formatNumIDR(p.totalRevenue)}
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 pb-3">
                <ActivityPagination
                  currentPage={currentPage}
                  totalItems={filteredProducts.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Products;
