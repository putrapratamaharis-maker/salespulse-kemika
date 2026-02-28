import { useState } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { Deal, formatIDR, formatIDRFull, formatPercent, formatDate } from '@/types/sales';
import { getUserDeals, mockAccounts } from '@/data/mockData';
import { GitBranch, TrendingUp, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { NewLeadDialog } from '@/components/pipeline/NewLeadDialog';

const stageOrder = ['prospect', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const stageLabels: Record<string, string> = {
  prospect: 'Prospect',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};
const stageColors: Record<string, 'green' | 'yellow' | 'red'> = {
  prospect: 'red',
  qualification: 'yellow',
  proposal: 'yellow',
  negotiation: 'green',
  closed_won: 'green',
  closed_lost: 'red',
};

const MyPipeline = () => {
  const { currentUser } = useAppContext();
  const [addedDeals, setAddedDeals] = useState<Deal[]>([]);

  const deals = [...getUserDeals(currentUser.id), ...addedDeals];

  const getAccountName = (accountId: string) =>
    mockAccounts.find(a => a.id === accountId)?.name || accountId;

  const handleAddDeal = (deal: Deal) => {
    setAddedDeals(prev => [...prev, deal]);
  };

  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const pipelineValue = activeDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = activeDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);
  const avgProbability = activeDeals.length > 0
    ? activeDeals.reduce((s, d) => s + d.probability, 0) / activeDeals.length
    : 0;

  const nearingClose = activeDeals.filter(d => {
    const days = (new Date(d.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30 && days >= 0;
  });

  const staleDeals = activeDeals.filter(d => d.daysInStage > 10);

  const stageSummary = stageOrder.filter(s => s !== 'closed_lost').map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    return {
      stage,
      label: stageLabels[stage],
      count: stageDeals.length,
      value: stageDeals.reduce((s, d) => s + d.value, 0),
      color: stageColors[stage],
    };
  });

  const maxStageValue = Math.max(...stageSummary.map(s => s.value), 1);

  const accountOptions = mockAccounts.map(a => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Leads & Forecast</h2>
          <p className="text-sm text-muted-foreground">Lead pipeline & forecast — {currentUser.name}</p>
        </div>
        <NewLeadDialog onAdd={handleAddDeal} accountOptions={accountOptions} salesId={currentUser.id} />
      </div>

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Pipeline Value" value={formatIDRFull(pipelineValue)} icon={DollarSign} autoFitText />
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} icon={TrendingUp} autoFitText />
        <KPICard label="Active Deals" value={String(activeDeals.length)} icon={GitBranch} autoFitText />
        <KPICard label="Avg Probability" value={formatPercent(avgProbability)} status={avgProbability >= 50 ? 'green' : 'yellow'} icon={TrendingUp} autoFitText />
      </div>

      {/* Stage Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Pipeline Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stageSummary.map(s => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <StatusBadge status={s.color} label={s.label} />
                </div>
                <div className="flex-1">
                  <Progress value={(s.value / maxStageValue) * 100} className="h-2" />
                </div>
                <span className="text-sm font-medium w-12 text-right">{s.count}</span>
                <span className="text-sm text-muted-foreground w-28 text-right">{formatIDR(s.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Nearing Close */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Closing Within 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nearingClose.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals closing soon.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Deal</TableHead>
                    <TableHead className="text-xs">Value</TableHead>
                    <TableHead className="text-xs">Prob.</TableHead>
                    <TableHead className="text-xs">Close Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nearingClose.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                      <TableCell><StatusBadge status={d.probability >= 60 ? 'green' : d.probability >= 30 ? 'yellow' : 'red'} label={`${d.probability}%`} /></TableCell>
                      <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stale Deals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-red" />
              Stale Deals ({'>'}10 days in stage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staleDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stale deals. Keep it up!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Deal</TableHead>
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-xs">Days</TableHead>
                    <TableHead className="text-xs">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staleDeals.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell><StatusBadge status={stageColors[d.stage]} label={stageLabels[d.stage]} /></TableCell>
                      <TableCell className="text-sm text-status-red font-semibold">{d.daysInStage}d</TableCell>
                      <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Deals Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">All Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Deal</TableHead>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs">Stage</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="text-xs">Probability</TableHead>
                <TableHead className="text-xs">Expected Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm">{getAccountName(d.accountId)}</TableCell>
                  <TableCell><StatusBadge status={stageColors[d.stage]} label={stageLabels[d.stage]} /></TableCell>
                  <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                  <TableCell className="text-sm">{d.probability}%</TableCell>
                  <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyPipeline;
