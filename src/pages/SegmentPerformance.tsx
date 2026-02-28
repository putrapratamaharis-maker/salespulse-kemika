import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDR, formatIDRFull, formatPercent } from '@/types/sales';
import { mockInvoices, mockDeals } from '@/data/mockData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Users, ShoppingCart, TrendingUp, BarChart3, RefreshCw, DollarSign } from 'lucide-react';

function SegmentKPIs({ segment }: { segment: 'B2G' | 'B2B' | 'B2C' }) {
  const invoices = mockInvoices.filter(i => i.segment === segment);
  const deals = mockDeals.filter(d => d.segment === segment);
  const revenue = invoices.reduce((s, i) => s + i.netSales, 0);
  const grossProfit = invoices.reduce((s, i) => s + i.grossProfit, 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const closedWon = deals.filter(d => d.stage === 'closed_won').length;
  const closedLost = deals.filter(d => d.stage === 'closed_lost').length;
  const totalClosed = closedWon + closedLost;
  const winRate = totalClosed > 0 ? (closedWon / totalClosed) * 100 : 0;
  const avgDealSize = closedWon > 0 ? deals.filter(d => d.stage === 'closed_won').reduce((s, d) => s + d.value, 0) / closedWon : 0;
  const paidInvoices = invoices.filter(i => i.paidDate).length;
  const totalInvoices = invoices.length;
  const conversionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;

  if (segment === 'B2G') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Tender Win Rate" value={formatPercent(winRate)} status={winRate >= 50 ? 'green' : 'yellow'} icon={Trophy} autoFitText />
        <KPICard label="Avg Deal Size" value={formatIDRFull(avgDealSize)} icon={DollarSign} autoFitText />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={BarChart3} autoFitText />
        <KPICard label="Revenue MTD" value={formatIDRFull(revenue)} change={9.2} changeLabel="vs last month" icon={TrendingUp} autoFitText />
        <KPICard label="AR Aging Health" value="Moderate" status="yellow" icon={RefreshCw} autoFitText />
        <KPICard label="Repeat Project Rate" value="33%" icon={RefreshCw} autoFitText />
      </div>
    );
  }

  if (segment === 'B2B') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Revenue MTD" value={formatIDRFull(revenue)} change={15.1} changeLabel="vs last month" icon={DollarSign} autoFitText />
        <KPICard label="Conversion Rate" value={formatPercent(conversionRate)} status={conversionRate >= 50 ? 'green' : 'yellow'} icon={TrendingUp} autoFitText />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={BarChart3} autoFitText />
        <KPICard label="Avg Order Value" value={formatIDRFull(avgDealSize)} icon={ShoppingCart} autoFitText />
        <KPICard label="Margin Compliance" value="85%" status="green" icon={BarChart3} autoFitText />
        <KPICard label="Repeat Order Rate" value="62%" status="green" icon={RefreshCw} autoFitText />
      </div>
    );
  }

  // B2C
  return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Revenue MTD" value={formatIDRFull(revenue)} change={5.8} changeLabel="vs last month" icon={DollarSign} autoFitText />
        <KPICard label="Conversion Rate" value={formatPercent(conversionRate)} icon={TrendingUp} autoFitText />
        <KPICard label="Contribution Margin" value={formatPercent(marginPct)} status={marginPct >= 20 ? 'green' : 'yellow'} icon={BarChart3} autoFitText />
        <KPICard label="Top SKU" value="Widget Pro X" icon={ShoppingCart} autoFitText />
        <KPICard label="Refund Rate" value="2.3%" status="green" icon={RefreshCw} autoFitText />
        <KPICard label="Marketplaces" value="2 Active" icon={Users} autoFitText />
      </div>
  );
}

const SegmentPerformance = () => {
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
          <SegmentKPIs segment="B2G" />
        </TabsContent>
        <TabsContent value="B2B" className="mt-4">
          <SegmentKPIs segment="B2B" />
        </TabsContent>
        <TabsContent value="B2C" className="mt-4">
          <SegmentKPIs segment="B2C" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SegmentPerformance;
