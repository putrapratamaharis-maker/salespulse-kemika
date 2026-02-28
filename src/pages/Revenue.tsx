import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatPercent } from '@/types/sales';
import { mockInvoices } from '@/data/mockData';
import { DollarSign, Percent, TrendingUp, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { monthlyRevenueData } from '@/data/mockData';

const Revenue = () => {
  const totalRevenue = mockInvoices.reduce((s, i) => s + i.netSales, 0);
  const totalGP = mockInvoices.reduce((s, i) => s + i.grossProfit, 0);
  const marginPct = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
  const compliantInvoices = mockInvoices.filter(i => i.netSales > 0 && (i.grossProfit / i.netSales) * 100 >= 17).length;
  const marginCompliance = mockInvoices.length > 0 ? (compliantInvoices / mockInvoices.length) * 100 : 0;

  const trendData = monthlyRevenueData.map(d => ({
    month: d.month,
    total: d.B2G + d.B2B + d.B2C,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Revenue & Margin</h2>
        <p className="text-sm text-muted-foreground">Financial performance and margin compliance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatIDR(totalRevenue)} change={14.2} changeLabel="vs last month" icon={DollarSign} />
        <KPICard label="Gross Profit" value={formatIDR(totalGP)} icon={TrendingUp} />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} />
        <KPICard label="Margin Compliance" value={formatPercent(marginCompliance)} status={marginCompliance >= 80 ? 'green' : 'yellow'} icon={CreditCard} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue Trend (in Millions)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--accent))', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Invoice #</TableHead>
                <TableHead className="text-xs">Net Sales</TableHead>
                <TableHead className="text-xs">Gross Profit</TableHead>
                <TableHead className="text-xs">Margin %</TableHead>
                <TableHead className="text-xs">Segment</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map(inv => {
                const m = inv.netSales > 0 ? (inv.grossProfit / inv.netSales) * 100 : 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.netSales)}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.grossProfit)}</TableCell>
                    <TableCell><StatusBadge status={m >= 17 ? 'green' : 'red'} label={formatPercent(m)} /></TableCell>
                    <TableCell className="text-sm">{inv.segment}</TableCell>
                    <TableCell>{inv.paidDate ? <StatusBadge status="green" label="Paid" /> : <StatusBadge status="yellow" label="Outstanding" />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Revenue;
