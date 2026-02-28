import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDR, formatPercent, getAchievementStatus, formatDate } from '@/types/sales';
import { getUserInvoices, getUserDeals, getUserTarget, getUserActivities } from '@/data/mockData';
import { Target, TrendingUp, DollarSign, Percent, BarChart3, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function SalesPersonDashboard() {
  const { currentUser } = useAppContext();
  const invoices = getUserInvoices(currentUser.id);
  const deals = getUserDeals(currentUser.id);
  const target = getUserTarget(currentUser.id);
  const activities = getUserActivities(currentUser.id);

  const revenue = invoices.reduce((s, i) => s + i.netSales, 0);
  const grossProfit = invoices.reduce((s, i) => s + i.grossProfit, 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const targetVal = target?.revenueTarget || 1;
  const achievementPct = (revenue / targetVal) * 100;
  const pipelineValue = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);
  const weightedForecast = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + d.value * d.probability / 100, 0);

  const overdueInvoices = invoices.filter(inv => !inv.paidDate && new Date(inv.dueDate) < new Date());
  const nearingDeals = deals.filter(d => {
    if (['closed_won', 'closed_lost'].includes(d.stage)) return false;
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30 && days >= 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Performance</h2>
        <p className="text-sm text-muted-foreground">Personal sales dashboard — {currentUser.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Revenue MTD" value={formatIDR(revenue)} change={12.5} changeLabel="vs last month" icon={DollarSign} />
        <KPICard label="Target Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} />
        <KPICard label="Pipeline Value" value={formatIDR(pipelineValue)} icon={BarChart3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KPICard label="Weighted Forecast" value={formatIDR(weightedForecast)} change={8.2} changeLabel="confidence" icon={TrendingUp} />
        <KPICard label="Weekly Activities" value={String(activities.length)} changeLabel={`${activities.length >= 5 ? 'On track' : 'Below minimum'}`} status={activities.length >= 5 ? 'green' : 'red'} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Deals Nearing Close
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nearingDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals closing within 30 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Deal</TableHead>
                    <TableHead className="text-xs">Value</TableHead>
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-xs">Close Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nearingDeals.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                      <TableCell><StatusBadge status={d.probability >= 60 ? 'green' : d.probability >= 30 ? 'yellow' : 'red'} label={d.stage.replace('_', ' ')} /></TableCell>
                      <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-red" />
              Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue invoices. Great job!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">{formatIDR(inv.netSales)}</TableCell>
                      <TableCell className="text-sm text-status-red">{formatDate(inv.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.slice(0, 5).map(act => (
                <TableRow key={act.id}>
                  <TableCell className="text-sm">{formatDate(act.date)}</TableCell>
                  <TableCell><StatusBadge status="green" label={act.type} /></TableCell>
                  <TableCell className="text-sm">{act.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
