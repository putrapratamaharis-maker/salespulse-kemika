import { useEffect, useState } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDRFull, formatPercent, getAchievementStatus } from '@/types/sales';
import {
  getUserInvoices, getUserDeals, getUserTarget, getUserActivities,
  getSubordinates, getAllDownstreamIds, mockInvoices, mockDeals,
  mockActivities, mockCoachingNotes, mockUsers, mockTargets
} from '@/data/mockData';
import { Target, Percent, TrendingUp, Award, CheckCircle, XCircle, Loader2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  org_role: string;
  data_source: string;
  default_weight: number;
  default_target: number;
  display_order: number;
}

interface ComputedKPI {
  definition: KPIDefinition;
  value: number;
  target: number;
  weight: number;
  score: number;
  status: 'green' | 'yellow' | 'red';
  formatted: string;
  targetFormatted: string;
}

function computeKPIValue(
  dataSource: string,
  userId: string,
  orgRole: string
): number {
  const isTeamRole = ['supervisor', 'sales_manager', 'representative_management'].includes(orgRole);
  const userIds = isTeamRole ? [userId, ...getAllDownstreamIds(userId)] : [userId];
  const salesIds = isTeamRole ? getAllDownstreamIds(userId) : [userId];

  const invoices = mockInvoices.filter(i => salesIds.includes(i.salesId));
  const deals = mockDeals.filter(d => salesIds.includes(d.salesId));
  const activities = mockActivities.filter(a => salesIds.includes(a.salesId));
  const revenue = invoices.reduce((s, i) => s + i.netSales, 0);
  const grossProfit = invoices.reduce((s, i) => s + i.grossProfit, 0);
  const targets = mockTargets.filter(t => salesIds.includes(t.userId));
  const totalTarget = targets.reduce((s, t) => s + t.revenueTarget, 0) || 1;

  switch (dataSource) {
    case 'revenue_achievement':
      return (revenue / totalTarget) * 100;

    case 'margin_compliance':
      return revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    case 'win_rate': {
      const total = deals.length;
      const won = deals.filter(d => d.stage === 'closed_won').length;
      return total > 0 ? (won / total) * 100 : 0;
    }

    case 'activity_count':
      return activities.length;

    case 'deal_volume':
      return deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).length;

    case 'pipeline_health': {
      const pipelineVal = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
        .reduce((s, d) => s + d.value, 0);
      const remaining = Math.max(totalTarget - revenue, 1);
      return (pipelineVal / remaining) * 100;
    }

    case 'team_activity_compliance': {
      const subordinates = getAllDownstreamIds(userId)
        .map(id => mockUsers.find(u => u.id === id))
        .filter(u => u?.orgRole === 'sales_person');
      if (subordinates.length === 0) return 0;
      const onTrack = subordinates.filter(u => {
        const acts = mockActivities.filter(a => a.salesId === u!.id);
        return acts.length >= 5;
      });
      return (onTrack.length / subordinates.length) * 100;
    }

    case 'coaching_notes_given':
      return mockCoachingNotes.filter(cn => cn.supervisorId === userId).length;

    case 'collection_rate': {
      const allInv = mockInvoices.filter(i => salesIds.includes(i.salesId));
      const paid = allInv.filter(i => i.paidDate);
      return allInv.length > 0 ? (paid.length / allInv.length) * 100 : 0;
    }

    case 'rep_coverage': {
      const regions = new Set(mockUsers.filter(u => u.orgRole === 'sales_person').map(u => u.region));
      const coveredRegions = new Set(
        mockUsers.filter(u => u.orgRole === 'sales_person' && mockActivities.some(a => a.salesId === u.id))
          .map(u => u.region)
      );
      return regions.size > 0 ? (coveredRegions.size / regions.size) * 100 : 0;
    }

    case 'segment_specific':
      return 75; // placeholder

    default:
      return 0;
  }
}

function formatKPIValue(dataSource: string, value: number): string {
  if (['revenue_achievement', 'margin_compliance', 'win_rate', 'team_activity_compliance', 'pipeline_health', 'collection_rate', 'rep_coverage', 'segment_specific'].includes(dataSource)) {
    return formatPercent(value);
  }
  return String(Math.round(value));
}

function formatTarget(dataSource: string, target: number): string {
  if (['activity_count', 'deal_volume', 'coaching_notes_given'].includes(dataSource)) {
    return String(target);
  }
  return formatPercent(target);
}

function getKPIStatus(value: number, target: number): 'green' | 'yellow' | 'red' {
  const pct = target > 0 ? (value / target) * 100 : 0;
  if (pct >= 100) return 'green';
  if (pct >= 80) return 'yellow';
  return 'red';
}

const MyKPIs = () => {
  const { currentUser } = useAppContext();
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      setLoading(true);
      const { data, error } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('org_role', currentUser.orgRole)
        .eq('is_active', true)
        .order('display_order');

      if (data && !error) {
        setDefinitions(data as KPIDefinition[]);
      }
      setLoading(false);
    }
    fetchKPIs();
  }, [currentUser.orgRole]);

  // Compute KPI values
  const computedKPIs: ComputedKPI[] = definitions.map(def => {
    const value = computeKPIValue(def.data_source, currentUser.id, currentUser.orgRole);
    const target = def.default_target;
    const weight = def.default_weight;
    const status = getKPIStatus(value, target);
    const score = Math.min((value / (target || 1)) * 100, 150) * weight / 100;

    return {
      definition: def,
      value,
      target,
      weight,
      score,
      status,
      formatted: formatKPIValue(def.data_source, value),
      targetFormatted: formatTarget(def.data_source, target),
    };
  });

  const compositeScore = computedKPIs.reduce((s, k) => s + k.score, 0);
  const isTeamRole = ['supervisor', 'sales_manager', 'representative_management'].includes(currentUser.orgRole);

  // Team member breakdown for team roles
  const teamMembers = isTeamRole
    ? getAllDownstreamIds(currentUser.id)
        .map(id => mockUsers.find(u => u.id === id))
        .filter(u => u && u.orgRole === 'sales_person')
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">My KPI's & Scores</h2>
        <p className="text-sm text-muted-foreground">
          {isTeamRole ? 'Team performance scorecard' : 'Personal KPI scorecard'} — {currentUser.name}
        </p>
      </div>

      {/* Composite Score */}
      <Card className="border-2 border-accent/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-accent/10">
              <Award className="h-8 w-8 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground font-medium">Composite KPI Score</p>
              <p className="text-3xl font-bold text-foreground">{compositeScore.toFixed(1)}</p>
              <Progress value={Math.min(compositeScore, 100)} className="mt-2 h-2" />
            </div>
            <StatusBadge
              status={compositeScore >= 100 ? 'green' : compositeScore >= 80 ? 'yellow' : 'red'}
              label={compositeScore >= 100 ? 'On Target' : compositeScore >= 80 ? 'Near Target' : 'Below Target'}
            />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - top 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {computedKPIs.slice(0, 4).map(kpi => (
          <KPICard
            key={kpi.definition.id}
            label={kpi.definition.name}
            value={kpi.formatted}
            status={kpi.status}
            icon={Target}
            autoFitText
          />
        ))}
      </div>

      {/* KPI Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">KPI Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {computedKPIs.map(kpi => (
              <div key={kpi.definition.id} className="flex items-center gap-4">
                <div className="w-44 shrink-0">
                  <p className="text-sm font-medium text-foreground">{kpi.definition.name}</p>
                  <p className="text-xs text-muted-foreground">Weight: {kpi.weight}%</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{kpi.formatted}</span>
                    <span className="text-xs text-muted-foreground">Target: {kpi.targetFormatted}</span>
                  </div>
                  <Progress value={Math.min((kpi.value / (kpi.target || 1)) * 100, 100)} className="h-1.5" />
                </div>
                <StatusBadge status={kpi.status} label={kpi.status === 'green' ? '✓' : kpi.status === 'yellow' ? '!' : '✗'} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Member Breakdown for Supervisor/Manager */}
      {isTeamRole && teamMembers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              Team Member Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  {definitions.slice(0, 4).map(def => (
                    <TableHead key={def.id} className="text-xs">{def.name.replace('Team ', '')}</TableHead>
                  ))}
                  <TableHead className="text-xs">Composite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map(member => {
                  if (!member) return null;
                  // Compute individual KPIs for this member using sales_person definitions
                  const memberKPIs = definitions.map(def => {
                    const val = computeKPIValue(def.data_source, member.id, 'sales_person');
                    const target = def.default_target;
                    const weight = def.default_weight;
                    return {
                      value: val,
                      target,
                      weight,
                      score: Math.min((val / (target || 1)) * 100, 150) * weight / 100,
                      status: getKPIStatus(val, target),
                      formatted: formatKPIValue(def.data_source, val),
                    };
                  });
                  const memberComposite = memberKPIs.reduce((s, k) => s + k.score, 0);

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="text-sm font-medium">{member.name}</TableCell>
                      {memberKPIs.slice(0, 4).map((k, i) => (
                        <TableCell key={i}>
                          <StatusBadge status={k.status} label={k.formatted} />
                        </TableCell>
                      ))}
                      <TableCell>
                        <span className="text-sm font-bold">{memberComposite.toFixed(1)}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Deal Scorecard for sales_person */}
      {currentUser.orgRole === 'sales_person' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(() => {
            const deals = getUserDeals(currentUser.id);
            const won = deals.filter(d => d.stage === 'closed_won').length;
            const lost = deals.filter(d => d.stage === 'closed_lost').length;
            const active = deals.length - won - lost;
            return (
              <>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <CheckCircle className="h-8 w-8 text-status-green mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">{won}</p>
                    <p className="text-xs text-muted-foreground">Deals Won</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <XCircle className="h-8 w-8 text-status-red mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">{lost}</p>
                    <p className="text-xs text-muted-foreground">Deals Lost</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <TrendingUp className="h-8 w-8 text-accent mx-auto mb-2" />
                    <p className="text-2xl font-bold text-foreground">{active}</p>
                    <p className="text-xs text-muted-foreground">Active Deals</p>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default MyKPIs;
