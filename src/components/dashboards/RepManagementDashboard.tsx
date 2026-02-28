import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatIDRFull, formatPercent, getAchievementStatus } from '@/types/sales';
import { mockInvoices, mockDeals, mockAccounts } from '@/data/mockData';
import { DollarSign, Target, Percent, MapPin, TrendingDown, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function RepManagementDashboard() {
  // Group by account type as proxy for channel/representative
  const channels = ['Government', 'Corporate', 'E-Commerce'];
  
  const channelData = channels.map(ch => {
    const accounts = mockAccounts.filter(a => a.type === ch);
    const accountIds = accounts.map(a => a.id);
    const invoices = mockInvoices.filter(inv => accountIds.includes(inv.accountId));
    const revenue = invoices.reduce((s, i) => s + i.netSales, 0);
    const grossProfit = invoices.reduce((s, i) => s + i.grossProfit, 0);
    const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const outstanding = invoices.filter(inv => !inv.paidDate).reduce((s, inv) => s + inv.netSales, 0);
    const deals = mockDeals.filter(d => accountIds.includes(d.accountId));
    const pipeline = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);

    return { channel: ch, revenue, marginPct, outstanding, pipeline, accountCount: accounts.length };
  });

  const totalRevenue = channelData.reduce((s, c) => s + c.revenue, 0);
  const totalOutstanding = channelData.reduce((s, c) => s + c.outstanding, 0);
  const totalPipeline = channelData.reduce((s, c) => s + c.pipeline, 0);

  const regions = [...new Set(mockAccounts.map(a => a.region))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Channel Performance</h2>
        <p className="text-sm text-muted-foreground">Revenue and margin by representative channel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatIDRFull(totalRevenue)} change={11.4} changeLabel="vs last month" icon={DollarSign} autoFitText />
        <KPICard label="Total Outstanding" value={formatIDRFull(totalOutstanding)} icon={CreditCard} autoFitText />
        <KPICard label="Total Pipeline" value={formatIDRFull(totalPipeline)} icon={TrendingDown} autoFitText />
        <KPICard label="Active Regions" value={String(regions.length)} icon={MapPin} autoFitText />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Channel Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Channel</TableHead>
                <TableHead className="text-xs">Accounts</TableHead>
                <TableHead className="text-xs">Revenue MTD</TableHead>
                <TableHead className="text-xs">Margin %</TableHead>
                <TableHead className="text-xs">Outstanding AR</TableHead>
                <TableHead className="text-xs">Pipeline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelData.map(c => (
                <TableRow key={c.channel}>
                  <TableCell className="text-sm font-medium">{c.channel}</TableCell>
                  <TableCell className="text-sm">{c.accountCount}</TableCell>
                  <TableCell className="text-sm font-medium">{formatIDR(c.revenue)}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.marginPct >= 17 ? 'green' : 'red'} label={formatPercent(c.marginPct)} />
                  </TableCell>
                  <TableCell className="text-sm">{formatIDR(c.outstanding)}</TableCell>
                  <TableCell className="text-sm">{formatIDR(c.pipeline)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-accent" />
            Region Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {regions.map(region => {
              const count = mockAccounts.filter(a => a.region === region).length;
              return (
                <div key={region} className="p-3 rounded-lg bg-secondary">
                  <div className="text-sm font-semibold text-foreground">{region}</div>
                  <div className="text-xs text-muted-foreground">{count} accounts</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
