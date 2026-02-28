import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatDate } from '@/types/sales';
import { mockInvoices } from '@/data/mockData';
import { CreditCard, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ARCashflow = () => {
  const now = new Date();
  const outstanding = mockInvoices.filter(inv => !inv.paidDate);
  const totalOutstanding = outstanding.reduce((s, inv) => s + inv.netSales, 0);
  const paid = mockInvoices.filter(inv => inv.paidDate);
  const totalPaid = paid.reduce((s, inv) => s + inv.netSales, 0);

  const overdue = outstanding.filter(inv => new Date(inv.dueDate) < now);
  const totalOverdue = overdue.reduce((s, inv) => s + inv.netSales, 0);

  // Aging buckets
  const current = outstanding.filter(inv => new Date(inv.dueDate) >= now);
  const overdue30 = outstanding.filter(inv => {
    const diff = (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 30;
  });
  const overdue60 = outstanding.filter(inv => {
    const diff = (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24);
    return diff > 30 && diff <= 60;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">AR & Cashflow</h2>
        <p className="text-sm text-muted-foreground">Accounts receivable aging and cash position</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Outstanding" value={formatIDR(totalOutstanding)} icon={CreditCard} />
        <KPICard label="Total Overdue" value={formatIDR(totalOverdue)} status={totalOverdue > 0 ? 'red' : 'green'} icon={AlertTriangle} />
        <KPICard label="Collected MTD" value={formatIDR(totalPaid)} icon={CheckCircle} />
        <KPICard label="Overdue Invoices" value={String(overdue.length)} status={overdue.length > 0 ? 'red' : 'green'} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-green">Current (Not Due)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(current.reduce((s, i) => s + i.netSales, 0))}</div>
            <div className="text-xs text-muted-foreground">{current.length} invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-yellow">1-30 Days Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(overdue30.reduce((s, i) => s + i.netSales, 0))}</div>
            <div className="text-xs text-muted-foreground">{overdue30.length} invoices</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-status-red">31-60 Days Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIDR(overdue60.reduce((s, i) => s + i.netSales, 0))}</div>
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
                const isOverdue = new Date(inv.dueDate) < now;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.netSales)}</TableCell>
                    <TableCell className="text-sm">{formatDate(inv.issueDate)}</TableCell>
                    <TableCell className="text-sm">{formatDate(inv.dueDate)}</TableCell>
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
