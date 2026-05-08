import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Loader2, TrendingUp, BarChart3, Layers, Crown, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityPagination } from '@/components/activities/ActivityPagination';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshKPIsButton } from '@/components/RefreshKPIsButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProductWithSales {
  id: string;
  name: string;
  category: string;
  totalRevenue: number;
  unitsSold: number;
  segments: string[];
}

interface DealGapRow {
  dealId: string;
  dealName: string;
  reference: string;
  accountId: string;
  headerValue: number;
  lineItemTotal: number;
  gap: number;
}

interface DealLineItem {
  id: string;
  product_name: string;
  category: string;
  unit: string;
  qty: number;
  price_per_unit: number;
  other_cost: number;
  line_total: number;
}

interface DealInvoiceRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  net_sales: number;
  gross_profit: number;
}

const DONUT_COLORS = [
  'hsl(220, 70%, 55%)', 'hsl(160, 60%, 45%)', 'hsl(30, 80%, 55%)',
  'hsl(340, 65%, 50%)', 'hsl(270, 55%, 55%)', 'hsl(190, 70%, 45%)',
  'hsl(50, 75%, 50%)', 'hsl(0, 65%, 50%)', 'hsl(140, 50%, 45%)',
  'hsl(300, 50%, 55%)',
];

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

  const [dealGaps, setDealGaps] = useState<DealGapRow[]>([]);
  const [accountMap, setAccountMap] = useState<Map<string, string>>(new Map());

  // Gap detail dialog state
  const [gapDetailOpen, setGapDetailOpen] = useState(false);
  const [gapDetailRow, setGapDetailRow] = useState<DealGapRow | null>(null);
  const [gapDetailLoading, setGapDetailLoading] = useState(false);
  const [gapDetailItems, setGapDetailItems] = useState<DealLineItem[]>([]);
  const [gapDetailInvoices, setGapDetailInvoices] = useState<DealInvoiceRow[]>([]);

  const openGapDetail = useCallback(async (row: DealGapRow) => {
    setGapDetailRow(row);
    setGapDetailOpen(true);
    setGapDetailLoading(true);
    setGapDetailItems([]);
    setGapDetailInvoices([]);
    try {
      const [{ data: items }, { data: invs }] = await Promise.all([
        supabase.from('deal_products').select('*').eq('deal_id', row.dealId),
        supabase.from('invoices').select('id, invoice_number, issue_date, due_date, paid_date, net_sales, gross_profit').eq('deal_id', row.dealId).order('issue_date', { ascending: false }),
      ]);
      setGapDetailItems(((items || []) as any[]).map(i => ({
        id: i.id,
        product_name: i.product_name,
        category: i.category,
        unit: i.unit,
        qty: Number(i.qty) || 0,
        price_per_unit: Number(i.price_per_unit) || 0,
        other_cost: Number(i.other_cost) || 0,
        line_total: (Number(i.qty) || 0) * (Number(i.price_per_unit) || 0) + (Number(i.other_cost) || 0),
      })));
      setGapDetailInvoices((invs || []) as any);
    } finally {
      setGapDetailLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
      setLoading(true);
      // Use SECURITY DEFINER functions to bypass RLS for company-wide data
      const [{ data: allDealProducts }, { data: allDeals }, { data: allAccounts }] = await Promise.all([
        supabase.rpc('get_all_deal_products_pipeline'),
        supabase.rpc('get_all_deals_pipeline'),
        supabase.rpc('get_accounts_basic'),
      ]);

      const accMap = new Map<string, string>();
      (allAccounts || []).forEach((a: any) => accMap.set(a.id, a.name));
      setAccountMap(accMap);

      // Build deal lookup for stage/segment
      const dealMap = new Map<string, { stage: string; segment: string; value: number; name: string; reference: string; account_id: string }>();
      (allDeals || []).forEach((d: any) => {
        dealMap.set(d.id, {
          stage: d.stage,
          segment: d.segment,
          value: Number(d.value) || 0,
          name: d.name,
          reference: d.reference_number || '',
          account_id: d.account_id,
        });
      });

      // Aggregate by product_name
      const salesByProduct = new Map<string, { revenue: number; units: number; segments: Set<string>; category: string }>();
      const lineItemByDeal = new Map<string, number>();

      (allDealProducts || []).forEach((dp: any) => {
        const deal = dealMap.get(dp.deal_id);
        if (!deal) return;
        const isWon = deal.stage === 'po_secured' || deal.stage === 'invoice_issued';
        if (!isWon) return;

        const key = dp.product_name || '—';
        const existing = salesByProduct.get(key) || { revenue: 0, units: 0, segments: new Set<string>(), category: dp.category || '—' };
        const lineRevenue = (Number(dp.qty) || 0) * (Number(dp.price_per_unit) || 0) + (Number(dp.other_cost) || 0);
        existing.revenue += lineRevenue;
        existing.units += Number(dp.qty) || 0;
        if (deal.segment) existing.segments.add(deal.segment);
        salesByProduct.set(key, existing);

        lineItemByDeal.set(dp.deal_id, (lineItemByDeal.get(dp.deal_id) || 0) + lineRevenue);
      });

      // Build gap rows for won deals
      const gaps: DealGapRow[] = [];
      dealMap.forEach((deal, dealId) => {
        const isWon = deal.stage === 'po_secured' || deal.stage === 'invoice_issued';
        if (!isWon) return;
        const lineTotal = lineItemByDeal.get(dealId) || 0;
        const gap = lineTotal - deal.value;
        if (Math.abs(gap) < 1) return; // ignore rounding noise
        gaps.push({
          dealId,
          dealName: deal.name,
          reference: deal.reference,
          accountId: deal.account_id,
          headerValue: deal.value,
          lineItemTotal: lineTotal,
          gap,
        });
      });
      gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
      setDealGaps(gaps);

      const merged: ProductWithSales[] = Array.from(salesByProduct.entries()).map(([name, s]) => ({
        id: name,
        name,
        category: s.category,
        totalRevenue: s.revenue,
        unitsSold: s.units,
        segments: Array.from(s.segments),
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      const uniqueCats = [...new Set(merged.map(p => p.category).filter(c => c !== '—'))].sort();
      setCategories(uniqueCats);
      setProducts(merged);
      setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatIDRFull = (val: number) => {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`;
    return `Rp ${Math.floor(val).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatNumIDR = (val: number) => Math.floor(val).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const stats = useMemo(() => {
    const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
    const totalUnits = products.reduce((s, p) => s + p.unitsSold, 0);
    const catCount = new Set(products.map(p => p.category).filter(c => c !== '—')).size;
    const withSales = products.filter(p => p.totalRevenue > 0).length;
    return { totalRevenue, totalUnits, categoryCount: catCount, withSales };
  }, [products]);

  // KPI "Total Revenue" — selaras dengan Executive Summary (Revenue YTD):
  // SUM(deals.value) header, stage IN (po_secured, invoice_issued), YEAR(expected_close_date) = tahun berjalan.
  const [revenueYTD, setRevenueYTD] = useState(0);
  useEffect(() => {
    const fetchYTD = async () => {
      const { data } = await supabase.rpc('get_all_deals_pipeline');
      const currentYear = new Date().getFullYear();
      const total = (data || []).reduce((sum: number, d: any) => {
        const isWon = d.stage === 'po_secured' || d.stage === 'invoice_issued';
        if (!isWon || !d.expected_close_date) return sum;
        const y = new Date(d.expected_close_date).getFullYear();
        if (y !== currentYear) return sum;
        return sum + (Number(d.value) || 0);
      }, 0);
      setRevenueYTD(total);
    };
    fetchYTD();
  }, [products]);

  const top10 = useMemo(() => products.slice(0, 10), [products]);
  const top10Max = useMemo(() => Math.max(...top10.map(p => p.totalRevenue), 1), [top10]);

  // Category donut data
  const categoryDonutData = useMemo(() => {
    const catRevenue = new Map<string, number>();
    products.forEach(p => {
      const cat = p.category || '—';
      catRevenue.set(cat, (catRevenue.get(cat) || 0) + p.totalRevenue);
    });
    return Array.from(catRevenue.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [products]);

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const pct = stats.totalRevenue > 0 ? (data.value / stats.totalRevenue) * 100 : 0;
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-md text-xs">
          <p className="font-semibold text-foreground">{data.name}</p>
          <p className="text-muted-foreground">Rp {formatNumIDR(data.value)}</p>
          <p className="text-muted-foreground">{pct.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Product Performance</h2>
          <p className="text-sm text-muted-foreground">Ringkasan performa penjualan per produk</p>
        </div>
        <RefreshKPIsButton onRefresh={fetchData} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="animate-fade-in border-0 bg-gradient-to-br from-indigo-600 to-indigo-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white/15">
              <TrendingUp className="h-5 w-5 text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Total Revenue</p>
              <p className="text-lg font-bold tracking-tight text-white">Rp {formatNumIDR(revenueYTD)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in border-0 bg-gradient-to-br from-teal-600 to-teal-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white/15">
              <Package className="h-5 w-5 text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Units Terjual</p>
              <p className="text-lg font-bold tracking-tight text-white">{stats.totalUnits.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in border-0 bg-gradient-to-br from-sky-600 to-sky-500">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white/15">
              <BarChart3 className="h-5 w-5 text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Produk Aktif</p>
              <p className="text-lg font-bold tracking-tight text-white">{stats.withSales} / {products.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in border-0 bg-gradient-to-br from-amber-500 to-amber-400">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-white/15">
              <Layers className="h-5 w-5 text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Kategori</p>
              <p className="text-lg font-bold tracking-tight text-white">{stats.categoryCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 + Category Donut side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top 10 Products */}
        {top10.length > 0 && (
          <Card className="animate-fade-in lg:col-span-2">
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

        {/* Category Donut */}
        {categoryDonutData.length > 0 && (
          <Card className="animate-fade-in">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Kategori Produk</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryDonutData.map((_, idx) => (
                        <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-3 space-y-1.5 max-h-[160px] overflow-y-auto">
                {categoryDonutData.map((cat, idx) => {
                  const pct = stats.totalRevenue > 0 ? (cat.value / stats.totalRevenue) * 100 : 0;
                  return (
                    <div key={cat.name} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                      />
                      <span className="truncate flex-1 text-foreground">{cat.name}</span>
                      <span className="text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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

      {/* Gap antara Header Deal Value vs Line Item Product */}
      {dealGaps.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">Selisih Deal Value vs Line Item Produk</CardTitle>
                <span className="text-xs text-muted-foreground">{dealGaps.length} deal</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">Total Selisih:</span>
                <span className={`font-semibold tabular-nums ${dealGaps.reduce((s, g) => s + g.gap, 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {dealGaps.reduce((s, g) => s + g.gap, 0) >= 0 ? '+' : ''}Rp {formatNumIDR(dealGaps.reduce((s, g) => s + g.gap, 0))}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Deal yang nilai header (<code>deals.value</code>) berbeda dengan total line item produknya. Sumber utama gap antara KPI Revenue YTD (Executive Summary) vs Total Revenue per Produk.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 w-[40px] text-xs text-white font-semibold bg-gradient-to-br from-slate-600 to-slate-500 rounded-tl-md py-3">#</TableHead>
                    <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-indigo-600 to-indigo-500 py-3">Reference</TableHead>
                    <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-sky-600 to-sky-500 py-3">Deal</TableHead>
                    <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-cyan-600 to-cyan-500 py-3">Account</TableHead>
                    <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-emerald-600 to-emerald-500 py-3 text-right">Header (Rp)</TableHead>
                    <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-teal-600 to-teal-500 py-3 text-right">Line Item (Rp)</TableHead>
                    <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-rose-500 to-rose-400 rounded-tr-md py-3 text-right">Selisih (Rp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dealGaps.slice(0, 50).map((g, idx) => (
                    <TableRow
                      key={g.dealId}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openGapDetail(g)}
                    >
                      <TableCell className="pl-6 text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-xs font-mono">{g.reference || '—'}</TableCell>
                      <TableCell className="text-sm font-medium">{g.dealName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{accountMap.get(g.accountId) || '—'}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatNumIDR(g.headerValue)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatNumIDR(g.lineItemTotal)}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold tabular-nums ${g.gap >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {g.gap >= 0 ? '+' : ''}{formatNumIDR(g.gap)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {dealGaps.length > 50 && (
              <p className="text-[11px] text-muted-foreground text-center py-2">Menampilkan 50 deal teratas dari {dealGaps.length} deal yang memiliki selisih.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gap Detail Dialog */}
      <Dialog open={gapDetailOpen} onOpenChange={setGapDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Detail Selisih Deal
            </DialogTitle>
            <DialogDescription className="text-xs">
              {gapDetailRow?.reference || '—'} • {gapDetailRow?.dealName} • {gapDetailRow ? (accountMap.get(gapDetailRow.accountId) || '—') : ''}
            </DialogDescription>
          </DialogHeader>

          {gapDetailRow && (
            <ScrollArea className="flex-1 pr-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Header Value</p>
                  <p className="text-sm font-semibold tabular-nums">Rp {formatNumIDR(gapDetailRow.headerValue)}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Line Item</p>
                  <p className="text-sm font-semibold tabular-nums">Rp {formatNumIDR(gapDetailRow.lineItemTotal)}</p>
                </div>
                <div className={`rounded-md border p-3 ${gapDetailRow.gap >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Selisih</p>
                  <p className={`text-sm font-semibold tabular-nums ${gapDetailRow.gap >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {gapDetailRow.gap >= 0 ? '+' : ''}Rp {formatNumIDR(gapDetailRow.gap)}
                  </p>
                </div>
              </div>

              {gapDetailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Line Items */}
                  <div className="mb-5">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5" /> Breakdown Line Items ({gapDetailItems.length})
                    </h4>
                    {gapDetailItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Tidak ada line item produk.</p>
                    ) : (
                      <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent bg-muted/40">
                              <TableHead className="text-[10px] py-2">Produk</TableHead>
                              <TableHead className="text-[10px] py-2 text-right">Qty</TableHead>
                              <TableHead className="text-[10px] py-2 text-right">Harga/Unit</TableHead>
                              <TableHead className="text-[10px] py-2 text-right">Other Cost</TableHead>
                              <TableHead className="text-[10px] py-2 text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gapDetailItems.map(it => (
                              <TableRow key={it.id}>
                                <TableCell className="text-xs">
                                  <div className="font-medium">{it.product_name}</div>
                                  <div className="text-[10px] text-muted-foreground">{it.category}</div>
                                </TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{it.qty.toLocaleString('id-ID')} {it.unit}</TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{formatNumIDR(it.price_per_unit)}</TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{formatNumIDR(it.other_cost)}</TableCell>
                                <TableCell className="text-xs text-right font-semibold tabular-nums">{formatNumIDR(it.line_total)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Invoices */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5" /> Transaksi Invoice ({gapDetailInvoices.length})
                    </h4>
                    {gapDetailInvoices.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Belum ada invoice yang terkait deal ini.</p>
                    ) : (
                      <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent bg-muted/40">
                              <TableHead className="text-[10px] py-2">No. Invoice</TableHead>
                              <TableHead className="text-[10px] py-2">Issue</TableHead>
                              <TableHead className="text-[10px] py-2">Due</TableHead>
                              <TableHead className="text-[10px] py-2">Paid</TableHead>
                              <TableHead className="text-[10px] py-2 text-right">Net Sales</TableHead>
                              <TableHead className="text-[10px] py-2 text-right">Gross Profit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gapDetailInvoices.map(inv => (
                              <TableRow key={inv.id}>
                                <TableCell className="text-xs font-mono">{inv.invoice_number}</TableCell>
                                <TableCell className="text-xs">{inv.issue_date}</TableCell>
                                <TableCell className="text-xs">{inv.due_date}</TableCell>
                                <TableCell className="text-xs">
                                  {inv.paid_date
                                    ? <Badge variant="secondary" className="text-[9px]">{inv.paid_date}</Badge>
                                    : <Badge variant="outline" className="text-[9px] text-amber-500">Unpaid</Badge>}
                                </TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{formatNumIDR(Number(inv.net_sales) || 0)}</TableCell>
                                <TableCell className="text-xs text-right tabular-nums">{formatNumIDR(Number(inv.gross_profit) || 0)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
