import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { formatIDRFull, formatPercent, getAchievementStatus, formatDate } from '@/types/sales';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Target, DollarSign, Percent, BarChart3, TrendingUp, AlertTriangle,
  Clock, FileWarning, Activity, CheckCircle2, CalendarClock, FileText, Loader2,
  Banknote, CreditCard
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';


import {
  getUserInvoices, getUserDeals, getUserTarget, getUserActivities
} from '@/data/mockData';

const MARGIN_THRESHOLD = 17;
const MIN_WEEKLY_ACTIVITIES = 5;

interface InvoiceRow {
  id: string;
  invoice_number: string;
  net_sales: number;
  gross_profit: number;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  segment: string;
  account_id: string;
  sales_id: string;
}

interface DealRow {
  id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string;
  days_in_stage: number;
  updated_at: string;
  segment: string;
  account_id: string;
  sales_id: string;
}

interface TargetRow {
  id: string;
  revenue_target: number;
  margin_target: number;
  month: string;
  segment: string;
  user_id: string;
}

interface ActivityRow {
  id: string;
  sales_id: string;
  type: string;
  activity_date: string;
  account_id: string | null;
  notes: string;
  next_action_date: string | null;
}

const MyPerformance = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [target, setTarget] = useState<TargetRow | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [useMock, setUseMock] = useState(false);

  // Redirect non-sales_person to KPIs page
  useEffect(() => {
    if (currentUser.orgRole !== 'sales_person') {
      navigate('/my-performance/kpis', { replace: true });
    }
  }, [currentUser.orgRole, navigate]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Try fetching from DB - use currentUser.id as sales_id
        const salesId = currentUser.id;

        const [invRes, dealRes, targetRes, actRes] = await Promise.all([
          supabase.from('invoices').select('*').eq('sales_id', salesId),
          supabase.from('deals').select('*').eq('sales_id', salesId),
          supabase.from('targets').select('*').eq('user_id', salesId).eq('month', currentMonth).limit(1),
          supabase.from('sales_activities').select('*').eq('sales_id', salesId),
        ]);

        const hasDBData = (invRes.data && invRes.data.length > 0) ||
                          (dealRes.data && dealRes.data.length > 0);

        if (hasDBData) {
          setInvoices((invRes.data || []) as InvoiceRow[]);
          setDeals((dealRes.data || []) as DealRow[]);
          setTarget((targetRes.data?.[0] as TargetRow) || null);
          setActivities((actRes.data || []) as ActivityRow[]);
          setUseMock(false);
        } else {
          // Fallback to mock
          setUseMock(true);
        }
      } catch {
        setUseMock(true);
      }
      setLoading(false);
    }
    fetchData();
  }, [currentUser.id, currentMonth]);

  // Resolve data source
  const mockInvoices = getUserInvoices(currentUser.id);
  const mockDeals = getUserDeals(currentUser.id);
  const mockTarget = getUserTarget(currentUser.id);
  const mockActs = getUserActivities(currentUser.id);

  const inv = useMock ? mockInvoices.map(i => ({
    id: i.id, invoice_number: i.invoiceNumber, net_sales: i.netSales,
    gross_profit: i.grossProfit, issue_date: i.issueDate, due_date: i.dueDate,
    paid_date: i.paidDate || null, segment: i.segment, account_id: i.accountId, sales_id: i.salesId,
  })) : invoices;

  const dls = useMock ? mockDeals.map(d => ({
    id: d.id, name: d.name, value: d.value, stage: d.stage, probability: d.probability,
    expected_close_date: d.expectedCloseDate, days_in_stage: d.daysInStage,
    updated_at: d.updatedAt, segment: d.segment, account_id: d.accountId, sales_id: d.salesId,
  })) : deals;

  const tgt = useMock ? (mockTarget ? {
    id: mockTarget.id, revenue_target: mockTarget.revenueTarget,
    margin_target: mockTarget.marginTarget, month: mockTarget.month,
    segment: mockTarget.segment, user_id: mockTarget.userId,
  } : null) : target;

  const acts = useMock ? mockActs.map(a => ({
    id: a.id, sales_id: a.salesId, type: a.type, activity_date: a.date,
    account_id: a.accountId, notes: a.notes, next_action_date: null,
  })) : activities;

  // ===== SECTION 1: KPI Calculations =====
  const currentMonthNum = now.getMonth();
  const currentYearNum = now.getFullYear();

  // MTD invoices
  const mtdInv = inv.filter(i => {
    const d = new Date(i.issue_date);
    return d.getMonth() === currentMonthNum && d.getFullYear() === currentYearNum;
  });
  const revenueMTD = mtdInv.reduce((s, i) => s + i.net_sales, 0);
  const grossProfitMTD = mtdInv.reduce((s, i) => s + i.gross_profit, 0);

  // YTD invoices
  const ytdInv = inv.filter(i => new Date(i.issue_date).getFullYear() === currentYearNum);
  const revenueYTD = ytdInv.reduce((s, i) => s + i.net_sales, 0);

  const marginPct = revenueMTD > 0 ? (grossProfitMTD / revenueMTD) * 100 : 0;
  const targetRevenue = tgt?.revenue_target || 0;
  const achievementPct = targetRevenue > 0 ? (revenueMTD / targetRevenue) * 100 : 0;

  const openDeals = dls.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);

  const outstandingAR = inv.filter(i => !i.paid_date).reduce((s, i) => s + i.net_sales, 0);
  const overdueInvoices = inv.filter(i => !i.paid_date && new Date(i.due_date) < now);
  const overdueValue = overdueInvoices.reduce((s, i) => s + i.net_sales, 0);

  // Cash-In (Paid) — total paid invoices
  const paidInvoices = inv.filter(i => !!i.paid_date);
  const cashInValue = paidInvoices.reduce((s, i) => s + i.net_sales, 0);

  // Pipeline by time bucket (personal)
  const pipeline30 = openDeals.filter(d => {
    const days = (new Date(d.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).reduce((s, d) => s + d.value, 0);
  const pipeline60 = openDeals.filter(d => {
    const days = (new Date(d.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days > 30 && days <= 60;
  }).reduce((s, d) => s + d.value, 0);

  // Last month comparison (simplified)
  const lastMonthChange = 12.5; // placeholder until historical data available

  // ===== SECTION 2: Alerts =====
  const stagnantDeals = dls.filter(d =>
    !['closed_won', 'closed_lost'].includes(d.stage) && d.days_in_stage > 14
  );
  const lowMarginDeals = dls.filter(d =>
    !['closed_won', 'closed_lost'].includes(d.stage) && marginPct < MARGIN_THRESHOLD
  );
  const overdueInv30 = inv.filter(i => {
    if (i.paid_date) return false;
    const diff = (now.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24);
    return diff > 30;
  });
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekActivities = acts.filter(a => new Date(a.activity_date) >= weekStart);
  const lowActivity = weekActivities.length < MIN_WEEKLY_ACTIVITIES;

  const alerts: { icon: React.ElementType; label: string; count: number; color: 'red' | 'yellow'; route: string }[] = [];
  if (stagnantDeals.length > 0) alerts.push({ icon: Clock, label: 'Deals stagnant > 14 days', count: stagnantDeals.length, color: 'red', route: '/my-performance/pipeline' });
  if (lowMarginDeals.length > 0) alerts.push({ icon: Percent, label: `Deals with margin < ${MARGIN_THRESHOLD}%`, count: lowMarginDeals.length, color: 'yellow', route: '/my-performance/pipeline' });
  if (overdueInv30.length > 0) alerts.push({ icon: FileWarning, label: 'Invoices overdue > 30 days', count: overdueInv30.length, color: 'red', route: '/ar-cashflow' });
  if (lowActivity) alerts.push({ icon: Activity, label: `Weekly activities below target (${weekActivities.length}/${MIN_WEEKLY_ACTIVITIES})`, count: MIN_WEEKLY_ACTIVITIES - weekActivities.length, color: 'yellow', route: '/my-performance/activities' });

  // ===== SECTION 3: Trend Data (last 3 months mock) =====
  const trendMonths = ['Dec', 'Jan', 'Feb'];
  const revenueTrend = [
    { month: 'Dec', revenue: revenueYTD * 0.82 },
    { month: 'Jan', revenue: revenueYTD * 0.91 },
    { month: 'Feb', revenue: revenueYTD },
  ];
  const marginTrend = [
    { month: 'Dec', margin: marginPct * 0.95 },
    { month: 'Jan', margin: marginPct * 0.98 },
    { month: 'Feb', margin: marginPct },
  ];
  const forecastData = openDeals.map(d => ({
    name: d.name.length > 20 ? d.name.slice(0, 20) + '…' : d.name,
    value: d.value,
    weighted: d.value * d.probability / 100,
  }));

  // ===== SECTION 4: Upcoming =====
  const closingSoon = dls.filter(d => {
    if (['closed_won', 'closed_lost'].includes(d.stage)) return false;
    const days = (new Date(d.expected_close_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 14;
  });
  const invoicesDueSoon = inv.filter(i => {
    if (i.paid_date) return false;
    const days = (new Date(i.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  });
  const todayStr = now.toISOString().slice(0, 10);
  const followUpsToday = acts.filter(a => a.next_action_date === todayStr);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">My Sales Overview</h2>
        <p className="text-sm text-muted-foreground">
          Personal Sales Control Cockpit — {currentUser.name}
          {useMock && <span className="ml-2 text-xs text-status-yellow">(Demo Data)</span>}
        </p>
      </div>

      {/* SECTION 1 — Row 1: 5 cards matching Executive Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Actual Revenue YTD" value={formatIDRFull(revenueYTD)} icon={Banknote} status={achievementPct >= 100 ? 'green' : achievementPct >= 80 ? 'yellow' : 'red'} autoFitText />
        <KPICard label="Total Revenue MTD" value={formatIDRFull(revenueMTD)} change={lastMonthChange} changeLabel="vs last month" icon={DollarSign} autoFitText />
        <KPICard label="Total Target" value={formatIDRFull(targetRevenue)} icon={Target} autoFitText />
        <KPICard label="Target Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} autoFitText />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= MARGIN_THRESHOLD ? 'green' : 'red'} icon={Percent} autoFitText />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="GP Contribution" value={formatIDRFull(grossProfitMTD)} icon={TrendingUp} autoFitText />
        <KPICard label="Total Pipeline Value" value={formatIDRFull(pipelineValue)} changeLabel={`${openDeals.length} open deals`} icon={BarChart3} autoFitText />
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} icon={TrendingUp} autoFitText />
        <KPICard label="Cash-In (Paid)" value={formatIDRFull(cashInValue)} status={cashInValue > 0 ? 'green' : 'yellow'} changeLabel={`${paidInvoices.length} invoices`} icon={Banknote} autoFitText />
      </div>

      {/* SECTION 2 — Action Required Panel */}
      <Card className={alerts.length > 0 ? 'border-status-red/30 bg-status-red-bg/20' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${alerts.length > 0 ? 'text-status-red' : 'text-status-green'}`} />
            Action Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-status-green">
              <CheckCircle2 className="h-4 w-4" />
              Tidak ada risiko signifikan. Tetap jaga performa.
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <button
                  key={i}
                  onClick={() => navigate(alert.route)}
                  className="w-full flex items-center gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`p-1.5 rounded-md ${alert.color === 'red' ? 'bg-status-red-bg' : 'bg-status-yellow-bg'}`}>
                    <alert.icon className={`h-4 w-4 ${alert.color === 'red' ? 'text-status-red' : 'text-status-yellow'}`} />
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1">{alert.label}</span>
                  <StatusBadge status={alert.color} label={`${alert.count}`} />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3 — Performance Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Trend (3M)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1e9).toFixed(1)}B`} />
                <Tooltip formatter={(v: number) => formatIDRFull(v)} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--accent))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Gross Margin Trend (3M)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={marginTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 40]} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Line type="monotone" dataKey="margin" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--chart-2))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline Closing Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {forecastData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No open deals.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={forecastData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1e9).toFixed(1)}B`} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => formatIDRFull(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" name="Deal Value" fill="hsl(var(--chart-1))" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="weighted" name="Weighted" fill="hsl(var(--accent))" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4 — Upcoming & Reminder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Deals closing in 14 days */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-accent" />
              Closing in 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {closingSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals closing soon.</p>
            ) : (
              <div className="space-y-2">
                {closingSoon.map(d => (
                  <button
                    key={d.id}
                    onClick={() => navigate('/my-performance/pipeline')}
                    className="w-full text-left p-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-sm font-medium text-foreground">{d.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{formatIDRFull(d.value)}</span>
                      <StatusBadge status={d.probability >= 60 ? 'green' : d.probability >= 30 ? 'yellow' : 'red'} label={`${d.probability}%`} />
                      <span className="text-xs text-muted-foreground">{formatDate(d.expected_close_date)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups today */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              Follow-up Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {followUpsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {followUpsToday.map(a => (
                  <button
                    key={a.id}
                    onClick={() => navigate('/my-performance/activities')}
                    className="w-full text-left p-2.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-sm font-medium text-foreground capitalize">{a.type}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.notes}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices due in 7 days */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-status-yellow" />
              Invoices Due in 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesDueSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices due soon.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesDueSoon.map(i => (
                    <TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/ar-cashflow')}>
                      <TableCell className="text-sm font-medium">{i.invoice_number}</TableCell>
                      <TableCell className="text-sm">{formatIDRFull(i.net_sales)}</TableCell>
                      <TableCell className="text-sm">{formatDate(i.due_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyPerformance;
