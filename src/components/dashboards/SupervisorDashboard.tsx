import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDRFull, formatPercent, getAchievementStatus } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { Users, Target, DollarSign, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface TeamMember {
  userId: string;
  name: string;
  region: string;
  revenue: number;
  marginPct: number;
  achievementPct: number;
  pipelineValue: number;
  activityCount: number;
  stuckDeals: number;
  overdueInvoices: number;
}

export function SupervisorDashboard() {
  const { currentUser } = useAppContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teamData, setTeamData] = useState<TeamMember[]>([]);

  useEffect(() => {
    async function fetchTeamData() {
      if (!user?.id) return;
      setLoading(true);

      // Get subordinates (profiles where supervisor_id matches current user's profile id)
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!myProfile) { setLoading(false); return; }

      const { data: subordinates } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, region')
        .eq('supervisor_id', myProfile.id)
        .eq('is_active', true);

      if (!subordinates || subordinates.length === 0) { setLoading(false); return; }

      const subUserIds = subordinates.map(s => s.user_id);

      // Fetch all data in parallel
      const [{ data: invoices }, { data: deals }, { data: targets }, { data: activities }] = await Promise.all([
        supabase.from('invoices').select('sales_id, net_sales, gross_profit, due_date, paid_date').in('sales_id', subUserIds),
        supabase.from('deals').select('sales_id, value, probability, stage, days_in_stage').in('sales_id', subUserIds),
        supabase.from('targets').select('user_id, revenue_target').in('user_id', subUserIds),
        supabase.from('sales_activities').select('sales_id').in('sales_id', subUserIds),
      ]);

      const allInvoices = invoices || [];
      const allDeals = deals || [];
      const allTargets = targets || [];
      const allActivities = activities || [];

      const team: TeamMember[] = subordinates.map(sub => {
        const userInvoices = allInvoices.filter(i => i.sales_id === sub.user_id);
        const userDeals = allDeals.filter(d => d.sales_id === sub.user_id);
        const userTarget = allTargets.find(t => t.user_id === sub.user_id);
        const userActivities = allActivities.filter(a => a.sales_id === sub.user_id);

        const revenue = userInvoices.reduce((s, i) => s + Number(i.net_sales), 0);
        const grossProfit = userInvoices.reduce((s, i) => s + Number(i.gross_profit), 0);
        const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
        const achievementPct = userTarget ? (revenue / Number(userTarget.revenue_target)) * 100 : 0;
        const openDeals = userDeals.filter(d => !['closed_won', 'closed_lost', 'canceled', 'lost'].includes(d.stage));
        const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0);
        const stuckDeals = openDeals.filter(d => d.days_in_stage > 14).length;
        const overdueInvoices = userInvoices.filter(inv => !inv.paid_date && new Date(inv.due_date) < new Date()).length;

        return {
          userId: sub.user_id,
          name: sub.full_name,
          region: sub.region || '',
          revenue, marginPct, achievementPct, pipelineValue,
          activityCount: userActivities.length,
          stuckDeals, overdueInvoices,
        };
      });

      setTeamData(team);
      setLoading(false);
    }
    fetchTeamData();
  }, [user?.id]);

  const totalRevenue = teamData.reduce((s, d) => s + d.revenue, 0);
  const totalTarget = teamData.reduce((s, d) => s + (d.achievementPct > 0 ? d.revenue / d.achievementPct * 100 : 0), 0);
  const teamAchievement = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
  const totalPipeline = teamData.reduce((s, d) => s + d.pipelineValue, 0);
  const stuckCount = teamData.reduce((s, d) => s + d.stuckDeals, 0);

  const ranked = [...teamData].sort((a, b) => b.achievementPct - a.achievementPct);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Team Performance</h2>
        <p className="text-sm text-muted-foreground">{teamData.length} direct reports — {currentUser.segment} segment</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Team Revenue MTD" value={formatIDRFull(totalRevenue)} icon={DollarSign} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" />
        <KPICard label="Team Achievement" value={formatPercent(teamAchievement)} status={getAchievementStatus(teamAchievement)} icon={Target} autoFitText className="bg-kpi-teal " borderAccent="border-l-kpi-teal-border" />
        <KPICard label="Total Pipeline" value={formatIDRFull(totalPipeline)} icon={TrendingUp} autoFitText className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" />
        <KPICard label="Stuck Deals" value={String(stuckCount)} status={stuckCount > 0 ? 'red' : 'green'} icon={AlertTriangle} autoFitText className="bg-kpi-rose " borderAccent="border-l-kpi-rose-border" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" />
            Sales Ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada data tim.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs">Sales Person</TableHead>
                   <TableHead className="text-xs">Revenue MTD (Rp)</TableHead>
                  <TableHead className="text-xs">Achievement</TableHead>
                  <TableHead className="text-xs">Margin %</TableHead>
                  <TableHead className="text-xs">Pipeline (Rp)</TableHead>
                  <TableHead className="text-xs">Activities</TableHead>
                  <TableHead className="text-xs">Alerts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((d, idx) => (
                  <TableRow
                    key={d.userId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/profile/${d.userId}`)}
                  >
                    <TableCell className="font-bold text-sm">{idx + 1}</TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.region}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{formatNumIDR(d.revenue)}</TableCell>
                    <TableCell>
                      <StatusBadge status={getAchievementStatus(d.achievementPct)} label={formatPercent(d.achievementPct)} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.marginPct >= 17 ? 'green' : 'red'} label={formatPercent(d.marginPct)} />
                    </TableCell>
                    <TableCell className="text-sm">{formatIDRFull(d.pipelineValue)}</TableCell>
                    <TableCell className="text-sm">{d.activityCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {d.stuckDeals > 0 && <StatusBadge status="red" label={`${d.stuckDeals} stuck`} />}
                        {d.overdueInvoices > 0 && <StatusBadge status="yellow" label={`${d.overdueInvoices} overdue`} />}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
