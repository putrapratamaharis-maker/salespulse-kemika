import { KPICard } from '@/components/KPICard';
import { useAppContext } from '@/context/AppContext';
import { formatIDR, formatPercent, getAchievementStatus } from '@/types/sales';
import { mockInvoices, mockDeals, mockTargets, monthlyRevenueData } from '@/data/mockData';
import { DollarSign, Target, Percent, CreditCard, TrendingUp, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function ManagerDashboard() {
  const totalRevenue = mockInvoices.reduce((s, i) => s + i.netSales, 0);
  const totalGrossProfit = mockInvoices.reduce((s, i) => s + i.grossProfit, 0);
  const totalTarget = mockTargets.reduce((s, t) => s + t.revenueTarget, 0);
  const marginPct = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  const achievementPct = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;

  const outstandingAR = mockInvoices.filter(inv => !inv.paidDate).reduce((s, inv) => s + inv.netSales, 0);

  const openDeals = mockDeals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const pipeline30 = openDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).reduce((s, d) => s + d.value, 0);
  const pipeline60 = openDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 30 && days <= 60;
  }).reduce((s, d) => s + d.value, 0);
  const pipeline90 = openDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 60 && days <= 90;
  }).reduce((s, d) => s + d.value, 0);

  const weightedForecast = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);

  // Segment breakdown
  const segments = ['B2G', 'B2B', 'B2C'] as const;
  const segmentRevenue = segments.map(seg => ({
    segment: seg,
    revenue: mockInvoices.filter(i => i.segment === seg).reduce((s, i) => s + i.netSales, 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Executive Summary</h2>
        <p className="text-sm text-muted-foreground">Company-wide sales performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue MTD" value={formatIDR(totalRevenue)} change={14.2} changeLabel="vs last month" icon={DollarSign} />
        <KPICard label="Target Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} />
        <KPICard label="Outstanding AR" value={formatIDR(outstandingAR)} icon={CreditCard} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Pipeline 30 Days" value={formatIDR(pipeline30)} icon={TrendingUp} />
        <KPICard label="Pipeline 60 Days" value={formatIDR(pipeline60)} icon={TrendingUp} />
        <KPICard label="Pipeline 90 Days" value={formatIDR(pipeline90)} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KPICard label="Weighted Forecast" value={formatIDR(weightedForecast)} change={8.5} changeLabel="reliability" icon={BarChart3} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Segment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {segmentRevenue.map(s => {
                const pct = totalRevenue > 0 ? (s.revenue / totalRevenue) * 100 : 0;
                return (
                  <div key={s.segment}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{s.segment}</span>
                      <span className="text-muted-foreground">{formatIDR(s.revenue)} ({formatPercent(pct)})</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue Trend by Segment (in Millions)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="B2G" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="B2B" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="B2C" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
