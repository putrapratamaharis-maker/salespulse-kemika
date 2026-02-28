import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDRFull, formatPercent, getAchievementStatus } from '@/types/sales';
import { getUserInvoices, getUserDeals, getUserTarget } from '@/data/mockData';
import { Target, Percent, TrendingUp, Award, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const MyKPIs = () => {
  const { currentUser } = useAppContext();
  const invoices = getUserInvoices(currentUser.id);
  const deals = getUserDeals(currentUser.id);
  const target = getUserTarget(currentUser.id);

  const revenue = invoices.reduce((s, i) => s + i.netSales, 0);
  const grossProfit = invoices.reduce((s, i) => s + i.grossProfit, 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const revenueTarget = target?.revenueTarget || 1;
  const marginTarget = target?.marginTarget || 20;
  const achievementPct = (revenue / revenueTarget) * 100;

  const totalDeals = deals.length;
  const wonDeals = deals.filter(d => d.stage === 'closed_won').length;
  const lostDeals = deals.filter(d => d.stage === 'closed_lost').length;
  const winRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
  const avgDealSize = totalDeals > 0 ? deals.reduce((s, d) => s + d.value, 0) / totalDeals : 0;

  const kpiScores = [
    { label: 'Revenue Achievement', value: achievementPct, target: 100, weight: 40, status: getAchievementStatus(achievementPct) },
    { label: 'Margin Compliance', value: marginPct, target: marginTarget, weight: 25, status: marginPct >= marginTarget ? 'green' as const : marginPct >= marginTarget * 0.8 ? 'yellow' as const : 'red' as const },
    { label: 'Win Rate', value: winRate, target: 50, weight: 20, status: winRate >= 50 ? 'green' as const : winRate >= 30 ? 'yellow' as const : 'red' as const },
    { label: 'Deal Volume', value: totalDeals, target: 5, weight: 15, status: totalDeals >= 5 ? 'green' as const : totalDeals >= 3 ? 'yellow' as const : 'red' as const },
  ];

  const compositeScore = kpiScores.reduce((s, k) => {
    const pct = Math.min((typeof k.value === 'number' ? k.value : 0) / k.target * 100, 150);
    return s + (pct * k.weight / 100);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">My KPI's & Scores</h2>
        <p className="text-sm text-muted-foreground">Key performance indicators — {currentUser.name}</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Revenue Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} autoFitText />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= marginTarget ? 'green' : 'red'} icon={Percent} autoFitText />
        <KPICard label="Win Rate" value={formatPercent(winRate)} status={winRate >= 50 ? 'green' : 'yellow'} icon={TrendingUp} autoFitText />
        <KPICard label="Avg Deal Size" value={formatIDRFull(avgDealSize)} icon={Award} autoFitText />
      </div>

      {/* KPI Breakdown Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">KPI Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {kpiScores.map((kpi) => (
              <div key={kpi.label} className="flex items-center gap-4">
                <div className="w-40 shrink-0">
                  <p className="text-sm font-medium text-foreground">{kpi.label}</p>
                  <p className="text-xs text-muted-foreground">Weight: {kpi.weight}%</p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">
                      {typeof kpi.value === 'number' && kpi.label !== 'Deal Volume'
                        ? formatPercent(kpi.value)
                        : kpi.value}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Target: {kpi.label !== 'Deal Volume' ? formatPercent(kpi.target) : kpi.target}
                    </span>
                  </div>
                  <Progress value={Math.min((Number(kpi.value) / kpi.target) * 100, 100)} className="h-1.5" />
                </div>
                <StatusBadge status={kpi.status} label={kpi.status === 'green' ? '✓' : kpi.status === 'yellow' ? '!' : '✗'} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deal Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-8 w-8 text-status-green mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{wonDeals}</p>
            <p className="text-xs text-muted-foreground">Deals Won</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <XCircle className="h-8 w-8 text-status-red mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{lostDeals}</p>
            <p className="text-xs text-muted-foreground">Deals Lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-8 w-8 text-accent mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">{totalDeals - wonDeals - lostDeals}</p>
            <p className="text-xs text-muted-foreground">Active Deals</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyKPIs;
