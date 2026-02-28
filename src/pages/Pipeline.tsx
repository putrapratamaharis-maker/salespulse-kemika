import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatIDRFull, formatPercent, formatDate } from '@/types/sales';
import { mockDeals, mockAccounts } from '@/data/mockData';
import { TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STAGE_COLORS: Record<string, string> = {
  prospect: 'hsl(var(--chart-5))',
  qualification: 'hsl(var(--chart-3))',
  proposal: 'hsl(var(--chart-4))',
  negotiation: 'hsl(var(--chart-2))',
  closed_won: 'hsl(var(--chart-1))',
};

const Pipeline = () => {
  const openDeals = mockDeals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);
  const stuckDeals = openDeals.filter(d => d.daysInStage > 10);

  // Stage breakdown
  const stages = ['prospect', 'qualification', 'proposal', 'negotiation'];
  const stageData = stages.map(stage => ({
    name: stage.charAt(0).toUpperCase() + stage.slice(1),
    value: openDeals.filter(d => d.stage === stage).reduce((s, d) => s + d.value, 0),
  })).filter(s => s.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Pipeline & Forecast</h2>
        <p className="text-sm text-muted-foreground">{openDeals.length} open deals in pipeline</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Total Pipeline" value={formatIDRFull(totalPipeline)} icon={BarChart3} autoFitText />
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} change={8.5} changeLabel="reliability" icon={TrendingUp} autoFitText />
        <KPICard label="Stuck Deals" value={String(stuckDeals.length)} status={stuckDeals.length > 0 ? 'yellow' : 'green'} icon={AlertTriangle} autoFitText />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={stageData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stageData.map((_, i) => (
                    <Cell key={i} fill={Object.values(STAGE_COLORS)[i % Object.values(STAGE_COLORS).length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => formatIDR(val)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">All Open Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Deal</TableHead>
                  <TableHead className="text-xs">Value</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs">Prob.</TableHead>
                  <TableHead className="text-xs">Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openDeals.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{mockAccounts.find(a => a.id === d.accountId)?.name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={d.daysInStage > 14 ? 'red' : d.daysInStage > 7 ? 'yellow' : 'green'}
                        label={d.stage.replace('_', ' ')}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{d.probability}%</TableCell>
                    <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Pipeline;
