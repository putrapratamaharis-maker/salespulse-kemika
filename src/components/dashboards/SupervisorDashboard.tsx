import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDR, formatIDRFull, formatPercent, getAchievementStatus } from '@/types/sales';
import { getSubordinates, getUserInvoices, getUserDeals, getUserTarget, getUserActivities, mockAccounts } from '@/data/mockData';
import { Users, Target, DollarSign, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';

export function SupervisorDashboard() {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const subordinates = getSubordinates(currentUser.id);

  const teamData = subordinates.map(sub => {
    const invoices = getUserInvoices(sub.id);
    const deals = getUserDeals(sub.id);
    const target = getUserTarget(sub.id);
    const activities = getUserActivities(sub.id);
    const revenue = invoices.reduce((s, i) => s + i.netSales, 0);
    const grossProfit = invoices.reduce((s, i) => s + i.grossProfit, 0);
    const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const achievementPct = target ? (revenue / target.revenueTarget) * 100 : 0;
    const pipelineValue = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);
    const stuckDeals = deals.filter(d => d.daysInStage > 14 && !['closed_won', 'closed_lost'].includes(d.stage));
    const overdueInvoices = invoices.filter(inv => !inv.paidDate && new Date(inv.dueDate) < new Date());

    return { user: sub, revenue, marginPct, achievementPct, pipelineValue, activityCount: activities.length, stuckDeals, overdueInvoices };
  });

  const totalRevenue = teamData.reduce((s, d) => s + d.revenue, 0);
  const totalTarget = subordinates.reduce((s, sub) => {
    const t = getUserTarget(sub.id);
    return s + (t?.revenueTarget || 0);
  }, 0);
  const teamAchievement = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
  const totalPipeline = teamData.reduce((s, d) => s + d.pipelineValue, 0);
  const stuckCount = teamData.reduce((s, d) => s + d.stuckDeals.length, 0);

  // Sort by achievement descending
  const ranked = [...teamData].sort((a, b) => b.achievementPct - a.achievementPct);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Team Performance</h2>
        <p className="text-sm text-muted-foreground">{subordinates.length} direct reports — {currentUser.segment} segment</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Team Revenue MTD" value={formatIDRFull(totalRevenue)} change={15.3} changeLabel="vs last month" icon={DollarSign} autoFitText />
        <KPICard label="Team Achievement" value={formatPercent(teamAchievement)} status={getAchievementStatus(teamAchievement)} icon={Target} autoFitText />
        <KPICard label="Total Pipeline" value={formatIDRFull(totalPipeline)} icon={TrendingUp} autoFitText />
        <KPICard label="Stuck Deals" value={String(stuckCount)} status={stuckCount > 0 ? 'red' : 'green'} icon={AlertTriangle} autoFitText />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            Sales Ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Sales Person</TableHead>
                <TableHead className="text-xs">Revenue MTD</TableHead>
                <TableHead className="text-xs">Achievement</TableHead>
                <TableHead className="text-xs">Margin %</TableHead>
                <TableHead className="text-xs">Pipeline</TableHead>
                <TableHead className="text-xs">Activities</TableHead>
                <TableHead className="text-xs">Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((d, idx) => (
                <TableRow
                  key={d.user.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/profile/${d.user.id}`)}
                >
                  <TableCell className="font-bold text-sm">{idx + 1}</TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm font-medium">{d.user.name}</div>
                      <div className="text-xs text-muted-foreground">{d.user.region}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{formatIDR(d.revenue)}</TableCell>
                  <TableCell>
                    <StatusBadge status={getAchievementStatus(d.achievementPct)} label={formatPercent(d.achievementPct)} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.marginPct >= 17 ? 'green' : 'red'} label={formatPercent(d.marginPct)} />
                  </TableCell>
                  <TableCell className="text-sm">{formatIDR(d.pipelineValue)}</TableCell>
                  <TableCell className="text-sm">{d.activityCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {d.stuckDeals.length > 0 && <StatusBadge status="red" label={`${d.stuckDeals.length} stuck`} />}
                      {d.overdueInvoices.length > 0 && <StatusBadge status="yellow" label={`${d.overdueInvoices.length} overdue`} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
