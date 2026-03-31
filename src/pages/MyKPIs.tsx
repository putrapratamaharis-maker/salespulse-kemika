import { useEffect, useState } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDRFull, formatPercent, getAchievementStatus } from '@/types/sales';
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

interface DBContext {
  invoices: any[];
  deals: any[];
  activities: any[];
  targets: any[];
  profiles: any[];
  subordinateIds: string[];
}

function computeKPIValue(
  dataSource: string,
  userId: string,
  orgRole: string,
  ctx: DBContext
): number {
  const isTeamRole = ['supervisor', 'sales_manager', 'representative_management'].includes(orgRole);
  const salesIds = isTeamRole ? ctx.subordinateIds : [userId];

  const invoices = ctx.invoices.filter((i: any) => salesIds.includes(i.sales_id));
  const deals = ctx.deals.filter((d: any) => salesIds.includes(d.sales_id));
  const activities = ctx.activities.filter((a: any) => salesIds.includes(a.sales_id));
  const revenue = invoices.reduce((s: number, i: any) => s + (i.net_sales || 0), 0);
  const grossProfit = invoices.reduce((s: number, i: any) => s + (i.gross_profit || 0), 0);
  const targets = ctx.targets.filter((t: any) => salesIds.includes(t.user_id));
  const totalTarget = targets.reduce((s: number, t: any) => s + (t.revenue_target || 0), 0) || 1;

  switch (dataSource) {
    case 'revenue_achievement':
      return (revenue / totalTarget) * 100;
    case 'margin_compliance':
      return revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    case 'win_rate': {
      const total = deals.length;
      const won = deals.filter((d: any) => d.stage === 'po_secured').length;
      return total > 0 ? (won / total) * 100 : 0;
    }
    case 'activity_count':
      return activities.length;
    case 'deal_volume':
      return deals.filter((d: any) => !['closed_won', 'closed_lost', 'po_secured', 'invoice_issued', 'canceled', 'lost'].includes(d.stage)).length;
    case 'pipeline_health': {
      const pipelineVal = deals.filter((d: any) => !['closed_won', 'closed_lost', 'po_secured', 'invoice_issued', 'canceled', 'lost'].includes(d.stage))
        .reduce((s: number, d: any) => s + d.value, 0);
      const remaining = Math.max(totalTarget - revenue, 1);
      return (pipelineVal / remaining) * 100;
    }
    case 'team_activity_compliance': {
      const subProfiles = ctx.profiles.filter((p: any) => ctx.subordinateIds.includes(p.user_id));
      if (subProfiles.length === 0) return 0;
      const onTrack = subProfiles.filter((p: any) => {
        const acts = ctx.activities.filter((a: any) => a.sales_id === p.user_id);
        return acts.length >= 5;
      });
      return (onTrack.length / subProfiles.length) * 100;
    }
    case 'coaching_notes_given':
      return 0; // placeholder until coaching_notes table
    case 'collection_rate': {
      const allInv = ctx.invoices.filter((i: any) => salesIds.includes(i.sales_id));
      const paid = allInv.filter((i: any) => i.paid_date);
      return allInv.length > 0 ? (paid.length / allInv.length) * 100 : 0;
    }
    case 'rep_coverage':
      return 75; // placeholder
    case 'segment_specific':
      return 75;
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
  const [dbCtx, setDbCtx] = useState<DBContext>({ invoices: [], deals: [], activities: [], targets: [], profiles: [], subordinateIds: [] });

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);

      // Get profile to find subordinates
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

      // Get subordinates recursively
      const { data: allProfiles } = await supabase.from('profiles').select('id, user_id, full_name, supervisor_id, segment');

      const profileList = allProfiles || [];
      const getSubIds = (supervisorProfileId: string): string[] => {
        const direct = profileList.filter(p => p.supervisor_id === supervisorProfileId);
        const ids: string[] = [];
        for (const d of direct) {
          ids.push(d.user_id);
          ids.push(...getSubIds(d.id));
        }
        return ids;
      };

      const subordinateIds = myProfile ? getSubIds(myProfile.id) : [];
      const allRelevantIds = [currentUser.id, ...subordinateIds];

      const [{ data: defs }, { data: invoices }, { data: deals }, { data: activities }, { data: targets }] = await Promise.all([
        supabase.from('kpi_definitions').select('*').eq('org_role', currentUser.orgRole).eq('is_active', true).order('display_order'),
        supabase.from('invoices').select('sales_id, net_sales, gross_profit, paid_date').in('sales_id', allRelevantIds),
        supabase.from('deals').select('sales_id, value, stage').in('sales_id', allRelevantIds),
        supabase.from('sales_activities').select('sales_id').in('sales_id', allRelevantIds),
        supabase.from('targets').select('user_id, revenue_target').in('user_id', allRelevantIds),
      ]);

      setDefinitions((defs || []) as KPIDefinition[]);
      setDbCtx({
        invoices: invoices || [],
        deals: deals || [],
        activities: activities || [],
        targets: targets || [],
        profiles: profileList,
        subordinateIds,
      });
      setLoading(false);
    }
    fetchAll();
  }, [currentUser.id, currentUser.orgRole]);

  const computedKPIs: ComputedKPI[] = definitions.map(def => {
    const value = computeKPIValue(def.data_source, currentUser.id, currentUser.orgRole, dbCtx);
    const target = def.default_target;
    const weight = def.default_weight;
    const status = getKPIStatus(value, target);
    const score = Math.min((value / (target || 1)) * 100, 150) * weight / 100;

    return {
      definition: def,
      value, target, weight, score, status,
      formatted: formatKPIValue(def.data_source, value),
      targetFormatted: formatTarget(def.data_source, target),
    };
  });

  const compositeScore = computedKPIs.reduce((s, k) => s + k.score, 0);
  const isTeamRole = ['supervisor', 'sales_manager', 'representative_management'].includes(currentUser.orgRole);

  const teamMembers = isTeamRole
    ? dbCtx.profiles.filter(p => dbCtx.subordinateIds.includes(p.user_id))
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {computedKPIs.slice(0, 4).map((kpi, idx) => {
          const kpiColors = [
            { bg: 'bg-kpi-blue', border: 'border-l-kpi-blue-border' },
            { bg: 'bg-kpi-teal', border: 'border-l-kpi-teal-border' },
            { bg: 'bg-kpi-amber', border: 'border-l-kpi-amber-border' },
            { bg: 'bg-kpi-purple', border: 'border-l-kpi-purple-border' },
          ];
          const color = kpiColors[idx % kpiColors.length];
          return (
            <KPICard key={kpi.definition.id} label={kpi.definition.name} value={kpi.formatted} status={kpi.status} icon={Target} autoFitText className={color.bg} borderAccent={color.border} />
          );
        })}
      </div>

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
                {teamMembers.map((member: any) => {
                  const memberKPIs = definitions.map(def => {
                    const val = computeKPIValue(def.data_source, member.user_id, 'sales_person', dbCtx);
                    const target = def.default_target;
                    const weight = def.default_weight;
                    return {
                      value: val, target, weight,
                      score: Math.min((val / (target || 1)) * 100, 150) * weight / 100,
                      status: getKPIStatus(val, target),
                      formatted: formatKPIValue(def.data_source, val),
                    };
                  });
                  const memberComposite = memberKPIs.reduce((s, k) => s + k.score, 0);

                  return (
                    <TableRow key={member.user_id}>
                      <TableCell className="text-sm font-medium">{member.full_name}</TableCell>
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

      {currentUser.orgRole === 'sales_person' && (
        <DealScorecard userId={currentUser.id} />
      )}
    </div>
  );
};

function DealScorecard({ userId }: { userId: string }) {
  const [deals, setDeals] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('deals').select('stage').eq('sales_id', userId).then(({ data }) => {
      setDeals(data || []);
    });
  }, [userId]);

  const won = deals.filter(d => d.stage === 'po_secured').length;
  const lost = deals.filter(d => d.stage === 'lost').length;
  const active = deals.length - won - lost;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>
  );
}

export default MyKPIs;
