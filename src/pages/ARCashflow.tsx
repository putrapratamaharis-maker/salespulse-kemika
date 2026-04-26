import { useState, useEffect, useCallback } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDRFull, formatNumIDR, formatDate } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, AlertTriangle, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshKPIsButton } from '@/components/RefreshKPIsButton';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  net_sales: number;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
}

const ARCashflow = () => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const fetchData = useCallback(async () => {
      setLoading(true);
      // Use SECURITY DEFINER RPC so all roles see the same corporate aggregate
      const { data } = await supabase.rpc('get_segment_invoices');
      const sorted = ((data || []) as InvoiceRow[])
        .slice()
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      setInvoices(sorted);
      setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const now = new Date();
  const outstanding = invoices.filter(inv => !inv.paid_date);
  const totalOutstanding = outstanding.reduce((s, inv) => s + inv.net_sales, 0);
  const paid = invoices.filter(inv => inv.paid_date);
  const totalPaid = paid.reduce((s, inv) => s + inv.net_sales, 0);

  const overdue = outstanding.filter(inv => new Date(inv.due_date) < now);
  const totalOverdue = overdue.reduce((s, inv) => s + inv.net_sales, 0);

  const current = outstanding.filter(inv => new Date(inv.due_date) >= now);
  const overdue30 = outstanding.filter(inv => {
    const diff = (now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 30;
  });
  const overdue60 = outstanding.filter(inv => {
    const diff = (now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24);
    return diff > 30 && diff <= 60;
  });

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
          <h2 className="text-xl font-bold text-foreground">AR & Cashflow</h2>
          <p className="text-sm text-muted-foreground">Accounts receivable aging and cash position</p>
        </div>
        <RefreshKPIsButton onRefresh={fetchData} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Outstanding" value={formatIDRFull(totalOutstanding)} icon={CreditCard} autoFitText className="bg-gradient-to-br from-indigo-600 to-indigo-500" tooltip="Total net_sales dari semua invoice yang belum dibayar" />
        <KPICard label="Total Overdue" value={formatIDRFull(totalOverdue)} status={totalOverdue > 0 ? 'red' : 'green'} icon={AlertTriangle} autoFitText className="bg-gradient-to-br from-rose-500 to-rose-400" tooltip="Total net_sales dari invoice yang sudah melewati due_date dan belum dibayar" />
        <KPICard label="Collected MTD" value={formatIDRFull(totalPaid)} icon={CheckCircle} autoFitText className="bg-gradient-to-br from-emerald-600 to-emerald-500" tooltip="Total net_sales dari invoice yang sudah dibayar (memiliki paid_date)" />
        <KPICard label="Overdue Invoices" value={String(overdue.length)} status={overdue.length > 0 ? 'red' : 'green'} icon={Clock} autoFitText className="bg-gradient-to-br from-amber-500 to-amber-400" tooltip="Jumlah invoice yang sudah melewati due_date dan belum dibayar" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-green">Current (Not Due)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDRFull(current.reduce((s, i) => s + i.net_sales, 0))}</div>
            <div className="text-xs text-muted-foreground">{current.length} invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-yellow">1-30 Days Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDRFull(overdue30.reduce((s, i) => s + i.net_sales, 0))}</div>
            <div className="text-xs text-muted-foreground">{overdue30.length} invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-red">31-60 Days Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDRFull(overdue60.reduce((s, i) => s + i.net_sales, 0))}</div>
            <div className="text-xs text-muted-foreground">{overdue60.length} invoices</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Outstanding Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-tl-md py-3">Invoice #</TableHead>
                <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-emerald-600 to-emerald-500 py-3 text-right">Amount (Rp)</TableHead>
                <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-sky-600 to-sky-500 py-3">Issue Date</TableHead>
                <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-amber-500 to-amber-400 py-3">Due Date</TableHead>
                <TableHead className="text-xs text-white font-semibold bg-gradient-to-br from-rose-500 to-rose-400 rounded-tr-md py-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.map(inv => {
                const isOverdue = new Date(inv.due_date) < now;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm text-right">{formatNumIDR(inv.net_sales)}</TableCell>
                    <TableCell className="text-sm">{formatDate(inv.issue_date)}</TableCell>
                    <TableCell className="text-sm">{formatDate(inv.due_date)}</TableCell>
                    <TableCell>
                      <StatusBadge status={isOverdue ? 'red' : 'green'} label={isOverdue ? 'Overdue' : 'Current'} />
                    </TableCell>
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

export default ARCashflow;
