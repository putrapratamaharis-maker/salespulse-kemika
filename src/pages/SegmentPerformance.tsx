import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { formatIDRFull, formatPercent } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, ShoppingCart, TrendingUp, BarChart3, RefreshCw, DollarSign, Loader2 } from 'lucide-react';

interface SegmentData {
  revenue: number;
  grossProfit: number;
  marginPct: number;
  winRate: number;
  avgDealSize: number;
  conversionRate: number;
}

function SegmentKPIs({ segment, data }: { segment: 'B2G' | 'B2B' | 'B2C'; data: SegmentData }) {
  const { revenue, marginPct, winRate, avgDealSize, conversionRate } = data;

  if (segment === 'B2G') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Tender Win Rate" value={formatPercent(winRate)} status={winRate >= 50 ? 'green' : 'yellow'} icon={Trophy} autoFitText className="bg-kpi-blue border-kpi-blue" />
        <KPICard label="Avg Deal Size" value={formatIDRFull(avgDealSize)} icon={DollarSign} autoFitText className="bg-kpi-teal border-kpi-teal" />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={BarChart3} autoFitText className="bg-kpi-amber border-kpi-amber" />
        <KPICard label="Revenue MTD" value={formatIDRFull(revenue)} icon={TrendingUp} autoFitText className="bg-kpi-purple border-kpi-purple" />
        <KPICard label="AR Aging Health" value="Moderate" status="yellow" icon={RefreshCw} autoFitText className="bg-kpi-rose border-kpi-rose" />
        <KPICard label="Repeat Project Rate" value="33%" icon={RefreshCw} autoFitText className="bg-kpi-emerald border-kpi-emerald" />
      </div>
    );
  }

  if (segment === 'B2B') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Revenue MTD" value={formatIDRFull(revenue)} icon={DollarSign} autoFitText />
        <KPICard label="Conversion Rate" value={formatPercent(conversionRate)} status={conversionRate >= 50 ? 'green' : 'yellow'} icon={TrendingUp} autoFitText />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={BarChart3} autoFitText />
        <KPICard label="Avg Order Value" value={formatIDRFull(avgDealSize)} icon={ShoppingCart} autoFitText />
        <KPICard label="Margin Compliance" value="85%" status="green" icon={BarChart3} autoFitText />
        <KPICard label="Repeat Order Rate" value="62%" status="green" icon={RefreshCw} autoFitText />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KPICard label="Revenue MTD" value={formatIDRFull(revenue)} icon={DollarSign} autoFitText />
      <KPICard label="Conversion Rate" value={formatPercent(conversionRate)} icon={TrendingUp} autoFitText />
      <KPICard label="Contribution Margin" value={formatPercent(marginPct)} status={marginPct >= 20 ? 'green' : 'yellow'} icon={BarChart3} autoFitText />
      <KPICard label="Top SKU" value="Widget Pro X" icon={ShoppingCart} autoFitText />
      <KPICard label="Refund Rate" value="2.3%" status="green" icon={RefreshCw} autoFitText />
      <KPICard label="Marketplaces" value="2 Active" icon={Users} autoFitText />
    </div>
  );
}

function computeSegment(invoices: any[], deals: any[]): SegmentData {
  const revenue = invoices.reduce((s: number, i: any) => s + (i.net_sales || 0), 0);
  const grossProfit = invoices.reduce((s: number, i: any) => s + (i.gross_profit || 0), 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const closedWon = deals.filter((d: any) => d.stage === 'po_secured').length;
  const closedLost = deals.filter((d: any) => d.stage === 'lost').length;
  const totalClosed = closedWon + closedLost;
  const winRate = totalClosed > 0 ? (closedWon / totalClosed) * 100 : 0;
  const avgDealSize = closedWon > 0 ? deals.filter((d: any) => d.stage === 'po_secured').reduce((s: number, d: any) => s + d.value, 0) / closedWon : 0;
  const paidInvoices = invoices.filter((i: any) => i.paid_date).length;
  const conversionRate = invoices.length > 0 ? (paidInvoices / invoices.length) * 100 : 0;
  return { revenue, grossProfit, marginPct, winRate, avgDealSize, conversionRate };
}

const SegmentPerformance = () => {
  const [loading, setLoading] = useState(true);
  const [segmentData, setSegmentData] = useState<Record<string, SegmentData>>({});

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: invoices }, { data: deals }] = await Promise.all([
        supabase.from('invoices').select('net_sales, gross_profit, segment, paid_date'),
        supabase.from('deals').select('value, stage, segment'),
      ]);
      const result: Record<string, SegmentData> = {};
      for (const seg of ['B2G', 'B2B', 'B2C']) {
        const segInv = (invoices || []).filter((i: any) => i.segment === seg);
        const segDeals = (deals || []).filter((d: any) => d.segment === seg);
        result[seg] = computeSegment(segInv, segDeals);
      }
      setSegmentData(result);
      setLoading(false);
    };
    fetch();
  }, []);

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
        <h2 className="text-xl font-bold text-foreground">Segment Performance</h2>
        <p className="text-sm text-muted-foreground">KPIs customized per business segment</p>
      </div>

      <Tabs defaultValue="B2G">
        <TabsList>
          <TabsTrigger value="B2G">B2G (Government)</TabsTrigger>
          <TabsTrigger value="B2B">B2B (Private)</TabsTrigger>
          <TabsTrigger value="B2C">B2C (E-Commerce)</TabsTrigger>
        </TabsList>
        <TabsContent value="B2G" className="mt-4">
          <SegmentKPIs segment="B2G" data={segmentData['B2G'] || { revenue: 0, grossProfit: 0, marginPct: 0, winRate: 0, avgDealSize: 0, conversionRate: 0 }} />
        </TabsContent>
        <TabsContent value="B2B" className="mt-4">
          <SegmentKPIs segment="B2B" data={segmentData['B2B'] || { revenue: 0, grossProfit: 0, marginPct: 0, winRate: 0, avgDealSize: 0, conversionRate: 0 }} />
        </TabsContent>
        <TabsContent value="B2C" className="mt-4">
          <SegmentKPIs segment="B2C" data={segmentData['B2C'] || { revenue: 0, grossProfit: 0, marginPct: 0, winRate: 0, avgDealSize: 0, conversionRate: 0 }} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SegmentPerformance;
