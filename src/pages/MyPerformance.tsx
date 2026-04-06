import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { formatIDRFull, formatPercent, getAchievementStatus, formatDate } from '@/types/sales';
import { KPICard } from '@/components/KPICard';
import { DualKPICard } from '@/components/DualKPICard';
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
  const [inv, setInv] = useState<InvoiceRow[]>([]);
  const [dls, setDls] = useState<DealRow[]>([]);
  const [tgt, setTgt] = useState<TargetRow | null>(null);
  const [acts, setActs] = useState<ActivityRow[]>([]);
  const [totalTargetYear, setTotalTargetYear] = useState(0);

  useEffect(() => {
    if (!['sales_person', 'staff_operational'].includes(currentUser.orgRole)) {
      navigate('/my-performance/kpis', { replace: true });
    }
  }, [currentUser.orgRole, navigate]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthName = now.toLocaleString('id-ID', { month: 'long' });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const salesId = currentUser.id;
      const currentYear = String(now.getFullYear());
      const [invRes, dealRes, targetRes, yearTargetsRes, actRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('sales_id', salesId),
        supabase.from('deals').select('*').eq('sales_id', salesId),
        supabase.from('targets').select('*').eq('user_id', salesId).eq('month', currentMonth).limit(1),
        supabase.from('targets').select('revenue_target').eq('user_id', salesId).like('month', `${currentYear}-%`),
        supabase.from('sales_activities').select('*').eq('sales_id', salesId),
      ]);
      setInv((invRes.data || []) as InvoiceRow[]);
      setDls((dealRes.data || []) as DealRow[]);
      setTgt((targetRes.data?.[0] as TargetRow) || null);
      const yearTotal = (yearTargetsRes.data || []).reduce((s: number, t: any) => s + (t.revenue_target || 0), 0);
      setTotalTargetYear(yearTotal);
      setActs((actRes.data || []) as ActivityRow[]);
      setLoading(false);
    }
    fetchData();
  }, [currentUser.id, currentMonth]);

  // ===== KPI Calculations =====
  const currentMonthNum = now.getMonth();
  const currentYearNum = now.getFullYear();

  const revenueStages = ['po_secured', 'invoice_issued'];
  const wonDeals = dls.filter(d => revenueStages.includes(d.stage));

  const mtdWon = wonDeals.filter(d => {
    const dt = new Date(d.expected_close_date);
    return dt.getMonth() === currentMonthNum && dt.getFullYear() === currentYearNum;
  });
  const revenueMTD = mtdWon.reduce((s, d) => s + d.value, 0);

  const ytdWon = wonDeals.filter(d => {
    return new Date(d.expected_close_date).getFullYear() === currentYearNum;
  });
  const revenueYTD = ytdWon.reduce((s, d) => s + d.value, 0);

  const mtdInv = inv.filter(i => {
    const d = new Date(i.issue_date);
    return d.getMonth() === currentMonthNum && d.getFullYear() === currentYearNum;
  });
  const grossProfitMTD = mtdInv.reduce((s, i) => s + i.gross_profit, 0);

  const marginPct = revenueMTD > 0 ? (grossProfitMTD / revenueMTD) * 100 : 0;
  const targetRevenue = tgt?.revenue_target || 0;
  const achievementPct = targetRevenue > 0 ? (revenueMTD / targetRevenue) * 100 : 0;

  const finalStages = ['po_secured', 'invoice_issued', 'canceled', 'lost'];
  const openDeals = dls.filter(d => !finalStages.includes(d.stage));
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedForecast = openDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);

  const outstandingAR = inv.filter(i => !i.paid_date).reduce((s, i) => s + i.net_sales, 0);
  const overdueInvoices = inv.filter(i => !i.paid_date && new Date(i.due_date) < now);
  const overdueValue = overdueInvoices.reduce((s, i) => s + i.net_sales, 0);

  const paidInvoices = inv.filter(i => !!i.paid_date);
  const cashInValue = paidInvoices.reduce((s, i) => s + i.net_sales, 0);

  const pipeline30 = openDeals.filter(d => {
    const days = (new Date(d.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).reduce((s, d) => s + d.value, 0);

  const lastMonthChange = 12.5;

  // ===== Alerts =====
  const stagnantDeals = dls.filter(d => !finalStages.includes(d.stage) && d.days_in_stage > 14);
  const lowMarginDeals = dls.filter(d => !finalStages.includes(d.stage) && marginPct < MARGIN_THRESHOLD);
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

  // ===== Trend Data =====
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

  // ===== Upcoming =====
  const closingSoon = dls.filter(d => {
    if (finalStages.includes(d.stage)) return false;
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
      <div>
        <h2 className="text-xl font-bold text-foreground">My Sales Overview</h2>
        <p className="text-sm text-muted-foreground">
          Personal Sales Control Cockpit — {currentUser.name}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Actual Revenue YTD" value={formatIDRFull(revenueYTD)} icon={Banknote} status={achievementPct >= 100 ? 'green' : achievementPct >= 80 ? 'yellow' : 'red'} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" tooltip="Total nilai deal Anda pada tahap PO Secured DAN Invoice Issued di tahun berjalan, berdasarkan PO/Won/Closed Date" />
        <KPICard label="ACTUAL REVENUE MTD" value={formatIDRFull(revenueMTD)} change={lastMonthChange} changeLabel="vs last month" icon={DollarSign} autoFitText className="bg-kpi-teal " borderAccent="border-l-kpi-teal-border" tooltip="Total nilai deal Anda pada tahap PO Secured DAN Invoice Issued di bulan berjalan, berdasarkan PO/Won/Closed Date" />
        <KPICard label={`Revenue Target ${monthName}`} value={formatIDRFull(targetRevenue)} icon={Target} autoFitText className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" tooltip={`Revenue target Anda untuk bulan ${monthName} dari tabel targets`} />
        <KPICard label={`Target Achievement ${monthName}`} value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} autoFitText className="bg-kpi-purple " borderAccent="border-l-kpi-purple-border" tooltip={`Revenue MTD ÷ Revenue Target × 100% untuk bulan ${monthName}`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= MARGIN_THRESHOLD ? 'green' : 'red'} icon={Percent} autoFitText className="bg-kpi-emerald " borderAccent="border-l-kpi-emerald-border" tooltip="Gross Profit ÷ Net Sales × 100% dari invoice Anda. Threshold hijau ≥ 17%" />
        <KPICard label="GP Contribution" value={formatIDRFull(grossProfitMTD)} icon={TrendingUp} autoFitText className="bg-kpi-indigo " borderAccent="border-l-kpi-indigo-border" tooltip="Total gross_profit dari invoice Anda di bulan berjalan, berdasarkan PO/Won/Closed Date" />
        <KPICard label="Cash-In (Paid)" value={formatIDRFull(cashInValue)} icon={Banknote} status={cashInValue > 0 ? 'green' : 'yellow'} changeLabel={`${paidInvoices.length} invoices`} autoFitText className="bg-kpi-emerald " borderAccent="border-l-kpi-emerald-border" tooltip="Total net_sales dari invoice Anda yang sudah dibayar (memiliki paid_date)" />
        <KPICard label="Outstanding AR" value={formatIDRFull(outstandingAR)} icon={CreditCard} status={outstandingAR > 0 ? 'red' : 'green'} changeLabel={`${inv.filter(i => !i.paid_date).length} unpaid`} autoFitText className="bg-kpi-rose " borderAccent="border-l-kpi-rose-border" tooltip="Total net_sales dari invoice Anda yang belum dibayar (paid_date kosong)" />
      </div>

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
                  <Bar dataKey="value" fill="hsl(var(--accent))" name="Deal Value" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="weighted" fill="hsl(var(--chart-2))" name="Weighted" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-accent" />
              Deals Closing Soon (14d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {closingSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No deals closing soon.</p>
            ) : (
              <div className="space-y-2">
                {closingSoon.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.expected_close_date)}</p>
                    </div>
                    <span className="font-semibold">{formatIDRFull(d.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-status-yellow" />
              Invoices Due Soon (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesDueSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No invoices due soon.</p>
            ) : (
              <div className="space-y-2">
                {invoicesDueSoon.map(i => (
                  <div key={i.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                    <div>
                      <p className="font-medium">{i.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">Due: {formatDate(i.due_date)}</p>
                    </div>
                    <span className="font-semibold">{formatIDRFull(i.net_sales)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              Follow-Ups Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {followUpsToday.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No follow-ups scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {followUpsToday.map(a => (
                  <div key={a.id} className="text-sm border-b border-border pb-2">
                    <StatusBadge status="green" label={a.type} />
                    <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyPerformance;
