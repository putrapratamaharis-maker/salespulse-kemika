import { useState, useMemo, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { Deal, DealStage, DealProduct, formatIDRFull, formatIDRAxis, formatPercent, formatDate } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, BarChart3, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { AllOpenDealsTable } from '@/components/pipeline/AllOpenDealsTable';

const Pipeline = () => {
  const [salesFilter, setSalesFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // DB state
  const [dbDeals, setDbDeals] = useState<Deal[]>([]);
  const [accountMap, setAccountMap] = useState<Map<string, string>>(new Map());
  const [accountPICMap, setAccountPICMap] = useState<Map<string, { picName?: string; picEmail?: string; picContact?: string }>>(new Map());
  const [salesUsers, setSalesUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [{ data: deals }, { data: accounts }, { data: profiles }, { data: dealProductsData }] = await Promise.all([
        supabase.rpc('get_all_deals_pipeline'),
        supabase.from('accounts').select('id, name, pic_name, pic_contact, pic_email'),
        supabase.rpc('get_active_sales_profiles'),
        supabase.rpc('get_all_deal_products_pipeline'),
      ]);

      // Map deal products
      const productsMap: Record<string, DealProduct[]> = {};
      (dealProductsData || []).forEach((dp: any) => {
        if (!productsMap[dp.deal_id]) productsMap[dp.deal_id] = [];
        productsMap[dp.deal_id].push({
          id: dp.id,
          category: dp.category,
          productName: dp.product_name,
          unit: dp.unit,
          qty: dp.qty,
          pricePerUnit: Number(dp.price_per_unit),
          otherCost: Number(dp.other_cost),
        });
      });

      // Map accounts
      const accMap = new Map((accounts || []).map(a => [a.id, a.name]));
      setAccountMap(accMap);
      const picMap = new Map((accounts || []).map(a => [a.id, { picName: a.pic_name, picEmail: a.pic_email, picContact: a.pic_contact }]));
      setAccountPICMap(picMap);

      // Map profiles for sales names
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

      // Convert deals
      const mappedDeals: Deal[] = (deals || []).map(d => ({
        id: d.id,
        accountId: d.account_id,
        salesId: d.sales_id,
        name: d.name,
        segment: d.segment as any,
        stage: d.stage as DealStage,
        value: Number(d.value),
        probability: d.probability,
        expectedCloseDate: d.expected_close_date,
        
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        daysInStage: d.days_in_stage,
        expectedMargin: Number(d.expected_margin) || 0,
        location: d.location || '',
        notes: d.notes || '',
        products: productsMap[d.id] || [],
      }));
      setDbDeals(mappedDeals);

      // Get unique sales users from deals
      const salesIds = [...new Set(mappedDeals.map(d => d.salesId))];
      setSalesUsers(salesIds.map(id => ({
        id,
        name: profileMap.get(id) || id,
      })));

      setLoading(false);
    }
    fetchData();
  }, []);

  const [localDeals, setLocalDeals] = useState<Deal[]>([]);

  useEffect(() => {
    setLocalDeals(dbDeals);
  }, [dbDeals]);

  const handleStageChange = (dealId: string, newStage: DealStage) => {
    const isFinalStage = newStage === 'po_secured' || newStage === 'invoice_issued';
    setLocalDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage, daysInStage: 0, ...(isFinalStage ? { probability: 100 } : {}) } : d));
  };

  const getSalesName = (salesId: string) =>
    salesUsers.find(u => u.id === salesId)?.name || salesId;

  const getAccountName = (accountId: string) =>
    accountMap.get(accountId) || accountId;

  const getAccountPIC = (accountId: string) =>
    accountPICMap.get(accountId);

  const allDeals = salesFilter === 'all'
    ? localDeals
    : localDeals.filter(d => d.salesId === salesFilter);
  const openDeals = allDeals.filter(d => !['po_secured', 'invoice_issued', 'canceled', 'lost'].includes(d.stage));
  const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);
  const stuckDeals = openDeals.filter(d => d.daysInStage > 14);

  // Stage breakdown
  const stages: DealStage[] = ['prospect', 'quotation', 'negotiation', 'po_secured', 'invoice_issued'];
  const STAGE_COLORS: Record<string, string> = {
    prospect: 'hsl(var(--chart-5))',
    quotation: 'hsl(var(--chart-3))',
    negotiation: 'hsl(var(--chart-4))',
    po_secured: 'hsl(var(--chart-2))',
    invoice_issued: 'hsl(var(--chart-1))',
  };
  const stageData = stages.map(stage => ({
    name: stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: openDeals.filter(d => d.stage === stage).reduce((s, d) => s + d.value, 0),
    color: STAGE_COLORS[stage],
  })).filter(s => s.value > 0);

  // Sales comparison data
  const salesComparisonData = useMemo(() => {
    const allOpen = localDeals.filter(d => !['canceled', 'lost'].includes(d.stage));
    const salesIds = [...new Set(allOpen.map(d => d.salesId))];
    return salesIds.map(id => {
      const userDeals = allOpen.filter(d => d.salesId === id);
      return {
        name: (salesUsers.find(u => u.id === id)?.name || id).split(' ')[0],
        pipeline: userDeals.reduce((s, d) => s + d.value, 0),
        forecast: userDeals.reduce((s, d) => s + d.value * d.probability / 100, 0),
        deals: userDeals.length,
      };
    }).sort((a, b) => b.pipeline - a.pipeline);
  }, [localDeals, salesUsers]);

  const filterLabel = salesFilter === 'all' ? 'all sales team' : getSalesName(salesFilter);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Pipeline & Forecast</h2>
          <p className="text-sm text-muted-foreground">Company-wide — {openDeals.length} open deals from {filterLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={salesFilter} onValueChange={setSalesFilter}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="All Sales Person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Sales Person</SelectItem>
              {salesUsers.map(u => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Pipeline" value={formatIDRFull(totalPipeline)} icon={BarChart3} autoFitText className="bg-kpi-blue" borderAccent="border-l-kpi-blue-border" tooltip="Total nilai semua deal aktif (Prospect, Quotation, Negotiation)" />
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} icon={TrendingUp} autoFitText className="bg-kpi-teal" borderAccent="border-l-kpi-teal-border" tooltip="Σ (value × probability / 100) dari deal aktif, tidak termasuk PO Secured, Invoice Issued, Canceled, Lost" />
        <KPICard label="Total Ticket/Card" value={String(allDeals.length)} icon={Users} autoFitText className="bg-kpi-purple" borderAccent="border-l-kpi-purple-border" tooltip="Total kartu/tiket deal di semua stages (termasuk PO Secured, Invoice Issued, Canceled, Lost)" />
        <KPICard label="Stuck Deals (>14D)" value={String(stuckDeals.length)} changeLabel={stuckDeals.length > 0 ? formatIDRFull(stuckDeals.reduce((s, d) => s + d.value, 0)) + ' at risk' : 'All clear!'} status={stuckDeals.length > 0 ? 'red' : 'green'} icon={AlertTriangle} autoFitText className="bg-kpi-rose" borderAccent="border-l-kpi-rose-border" tooltip="Jumlah deal aktif yang sudah > 14 hari tanpa perubahan stage" />
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        deals={allDeals}
        getAccountName={getAccountName}
        getAccountPIC={getAccountPIC}
        getSalesName={getSalesName}
        readOnly
      />

      {/* Sales Comparison Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pipeline Comparison per Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={salesComparisonData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickFormatter={(v: number) => formatIDRAxis(v)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={90} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0]?.payload;
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1">
                    <p className="font-semibold text-foreground">{label}</p>
                    {payload.map((entry: any, i: number) => (
                      <p key={i} style={{ color: entry.color }}>{entry.name}: {formatIDRFull(entry.value as number)}</p>
                    ))}
                    <p className="text-muted-foreground">Jumlah Deals: {data?.deals}</p>
                  </div>
                );
              }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pipeline" name="Pipeline Value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="forecast" name="Weighted Forecast" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pipeline by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={stageData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {stageData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(val: number) => formatIDRFull(val)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <AllOpenDealsTable
        deals={allDeals}
        getSalesName={getSalesName}
        getAccountName={getAccountName}
        getAccountPIC={getAccountPIC}
        salesPersons={salesUsers}
      />
    </div>
  );
};

export default Pipeline;
