import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatIDRFull, formatDate } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, AlertTriangle, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from('invoices').select('id, invoice_number, net_sales, issue_date, due_date, paid_date').order('due_date', { ascending: true });
      setInvoices((data || []) as InvoiceRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

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
      <div>
        <h2 className="text-xl font-bold text-foreground">AR & Cashflow</h2>
        <p className="text-sm text-muted-foreground">Accounts receivable aging and cash position</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Outstanding" value={formatIDRFull(totalOutstanding)} icon={CreditCard} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" tooltip="Total net_sales dari semua invoice yang belum dibayar" />
        <KPICard label="Total Overdue" value={formatIDRFull(totalOverdue)} status={totalOverdue > 0 ? 'red' : 'green'} icon={AlertTriangle} autoFitText className="bg-kpi-rose " borderAccent="border-l-kpi-rose-border" tooltip="Total net_sales dari invoice yang sudah melewati due_date dan belum dibayar" />
        <KPICard label="Collected MTD" value={formatIDRFull(totalPaid)} icon={CheckCircle} autoFitText className="bg-kpi-emerald " borderAccent="border-l-kpi-emerald-border" tooltip="Total net_sales dari invoice yang sudah dibayar (memiliki paid_date)" />
        <KPICard label="Overdue Invoices" value={String(overdue.length)} status={overdue.length > 0 ? 'red' : 'green'} icon={Clock} autoFitText className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" tooltip="Jumlah invoice yang sudah melewati due_date dan belum dibayar" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-green">Current (Not Due)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(current.reduce((s, i) => s + i.net_sales, 0))}</div>
            <div className="text-xs text-muted-foreground">{current.length} invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-yellow">1-30 Days Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(overdue30.reduce((s, i) => s + i.net_sales, 0))}</div>
            <div className="text-xs text-muted-foreground">{overdue30.length} invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-red">31-60 Days Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(overdue60.reduce((s, i) => s + i.net_sales, 0))}</div>
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
              <TableRow>
                <TableHead className="text-xs">Invoice #</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Issue Date</TableHead>
                <TableHead className="text-xs">Due Date</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.map(inv => {
                const isOverdue = new Date(inv.due_date) < now;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.net_sales)}</TableCell>
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
