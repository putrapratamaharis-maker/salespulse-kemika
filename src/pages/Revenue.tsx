import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatIDRFull, formatPercent } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Percent, TrendingUp, CreditCard, Loader2 } from 'lucide-react';
import NewInvoiceDialog from '@/components/invoices/NewInvoiceDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  net_sales: number;
  gross_profit: number;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  segment: string;
}

const Revenue = () => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from('invoices').select('id, invoice_number, net_sales, gross_profit, issue_date, due_date, paid_date, segment').order('issue_date', { ascending: false });
      setInvoices((data || []) as InvoiceRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const totalRevenue = invoices.reduce((s, i) => s + i.net_sales, 0);
  const totalGP = invoices.reduce((s, i) => s + i.gross_profit, 0);
  const marginPct = totalRevenue > 0 ? (totalGP / totalRevenue) * 100 : 0;
  const compliantInvoices = invoices.filter(i => i.net_sales > 0 && (i.gross_profit / i.net_sales) * 100 >= 17).length;
  const marginCompliance = invoices.length > 0 ? (compliantInvoices / invoices.length) * 100 : 0;

  // Build trend from invoice data grouped by month
  const monthlyMap = new Map<string, number>();
  invoices.forEach(inv => {
    const month = inv.issue_date.slice(0, 7); // YYYY-MM
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + inv.net_sales);
  });
  const trendData = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ month, total: total / 1_000_000 }));

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
        <h2 className="text-xl font-bold text-foreground">Revenue & Margin</h2>
        <p className="text-sm text-muted-foreground">Financial performance and margin compliance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatIDRFull(totalRevenue)} change={14.2} changeLabel="vs last month" icon={DollarSign} autoFitText />
        <KPICard label="Gross Profit" value={formatIDRFull(totalGP)} icon={TrendingUp} autoFitText />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} autoFitText />
        <KPICard label="Margin Compliance" value={formatPercent(marginCompliance)} status={marginCompliance >= 80 ? 'green' : 'yellow'} icon={CreditCard} autoFitText />
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
              {invoices.map(inv => {
                const m = inv.net_sales > 0 ? (inv.gross_profit / inv.net_sales) * 100 : 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.net_sales)}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.gross_profit)}</TableCell>
                    <TableCell><StatusBadge status={m >= 17 ? 'green' : 'red'} label={formatPercent(m)} /></TableCell>
                    <TableCell className="text-sm">{inv.segment}</TableCell>
                    <TableCell>{inv.paid_date ? <StatusBadge status="green" label="Paid" /> : <StatusBadge status="yellow" label="Outstanding" />}</TableCell>
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
