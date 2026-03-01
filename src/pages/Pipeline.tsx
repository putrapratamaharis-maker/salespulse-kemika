import { useState, useMemo } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { DealStage, formatIDR, formatIDRFull, formatPercent, formatDate } from '@/types/sales';
import { mockDeals, mockAccounts, mockUsers } from '@/data/mockData';
import { TrendingUp, BarChart3, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';

const Pipeline = () => {
  const [salesFilter, setSalesFilter] = useState<string>('all');
  const [localDeals, setLocalDeals] = useState(mockDeals);

  const handleStageChange = (dealId: string, newStage: DealStage) => {
    setLocalDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage, daysInStage: 0 } : d));
  };

  // Get sales users who have deals
  const salesWithDeals = useMemo(() => {
    const salesIds = [...new Set(mockDeals.map(d => d.salesId))];
    return salesIds
      .map(id => mockUsers.find(u => u.id === id))
      .filter(Boolean) as typeof mockUsers;
  }, []);

  const getSalesName = (salesId: string) =>
    mockUsers.find(u => u.id === salesId)?.name || salesId;

  const getAccountName = (accountId: string) =>
    mockAccounts.find(a => a.id === accountId)?.name || accountId;

  // Company-wide pipeline — aggregates deals from ALL sales users (or filtered)
  const allDeals = salesFilter === 'all'
    ? localDeals
    : localDeals.filter(d => d.salesId === salesFilter);
  const openDeals = allDeals.filter(d => !['canceled', 'lost'].includes(d.stage));
  const totalPipeline = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);
  const stuckDeals = openDeals.filter(d => d.daysInStage > 10);

  // Stage breakdown
  const stages: DealStage[] = ['prospect', 'quotation', 'negotiation', 'po_secured', 'invoice_issued'];
  const STAGE_COLORS: Record<string, string> = {
    prospect: 'hsl(var(--chart-5))',
    quotation: 'hsl(var(--chart-3))',
    negotiation: 'hsl(var(--chart-4))',
    po_secured: 'hsl(var(--chart-2))',
    invoice_issued: 'hsl(var(--chart-1))',
  };
  const stageData = stages.map(stage => ({
    name: stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: openDeals.filter(d => d.stage === stage).reduce((s, d) => s + d.value, 0),
    color: STAGE_COLORS[stage],
  })).filter(s => s.value > 0);

  // Sales comparison data — always from ALL deals (ignores filter)
  const salesComparisonData = useMemo(() => {
    const allOpen = localDeals.filter(d => !['canceled', 'lost'].includes(d.stage));
    const salesIds = [...new Set(allOpen.map(d => d.salesId))];
    return salesIds.map(id => {
      const userDeals = allOpen.filter(d => d.salesId === id);
      return {
        name: (mockUsers.find(u => u.id === id)?.name || id).split(' ')[0],
        pipeline: userDeals.reduce((s, d) => s + d.value, 0),
        forecast: userDeals.reduce((s, d) => s + d.value * d.probability / 100, 0),
        deals: userDeals.length,
      };
    }).sort((a, b) => b.pipeline - a.pipeline);
  }, [localDeals]);

  const filterLabel = salesFilter === 'all' ? 'all sales team' : getSalesName(salesFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Pipeline & Forecast</h2>
          <p className="text-sm text-muted-foreground">Company-wide — {openDeals.length} open deals from {filterLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={salesFilter} onValueChange={setSalesFilter}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="All Sales Person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Sales Person</SelectItem>
              {salesWithDeals.map(u => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Total Pipeline" value={formatIDRFull(totalPipeline)} icon={BarChart3} autoFitText />
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} change={8.5} changeLabel="reliability" icon={TrendingUp} autoFitText />
        <KPICard label="Stuck Deals" value={String(stuckDeals.length)} status={stuckDeals.length > 0 ? 'yellow' : 'green'} icon={AlertTriangle} autoFitText />
      </div>

      {/* Sales Comparison Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pipeline Comparison per Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={salesComparisonData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickFormatter={(v: number) => formatIDR(v)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={90} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0]?.payload;
                return (
                  <div className="rounded-lg border bg-background p-2.5 shadow-md text-xs space-y-1">
                    <p className="font-semibold text-foreground">{label}</p>
                    {payload.map((entry: any, i: number) => (
                      <p key={i} style={{ color: entry.color }}>{entry.name}: {formatIDR(entry.value as number)}</p>
                    ))}
                    <p className="text-muted-foreground">Jumlah Deals: {data?.deals}</p>
                  </div>
                );
              }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pipeline" name="Pipeline Value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="forecast" name="Weighted Forecast" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {/* Kanban Board — read-only view */}
      <KanbanBoard
        deals={allDeals}
        getAccountName={getAccountName}
        getSalesName={getSalesName}
        onStageChange={handleStageChange}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={stageData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stageData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
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
                  <TableHead className="text-xs">Sales</TableHead>
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
                    <TableCell className="text-sm text-muted-foreground">{getSalesName(d.salesId)}</TableCell>
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
