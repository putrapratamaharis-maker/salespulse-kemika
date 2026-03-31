import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDR, formatIDRFull, formatPercent, getAchievementStatus, formatDate } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { Target, TrendingUp, DollarSign, Percent, BarChart3, Clock, AlertTriangle, CreditCard, Banknote, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function SalesPersonDashboard() {
  const { currentUser } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [target, setTarget] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const sid = currentUser.id;
      const [invRes, dealRes, tgtRes, actRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('sales_id', sid),
        supabase.from('deals').select('*').eq('sales_id', sid),
        supabase.from('targets').select('*').eq('user_id', sid).eq('month', currentMonthStr).limit(1),
        supabase.from('sales_activities').select('*').eq('sales_id', sid).order('activity_date', { ascending: false }).limit(10),
      ]);
      setInvoices(invRes.data || []);
      setDeals(dealRes.data || []);
      setTarget(tgtRes.data?.[0] || null);
      setActivities(actRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [currentUser.id, currentMonthStr]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const mtdInvoices = invoices.filter(i => {
    const d = new Date(i.issue_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const revenueMTD = mtdInvoices.reduce((s: number, i: any) => s + (i.net_sales || 0), 0);
  const grossProfitMTD = mtdInvoices.reduce((s: number, i: any) => s + (i.gross_profit || 0), 0);

  const ytdInvoices = invoices.filter(i => new Date(i.issue_date).getFullYear() === currentYear);
  const revenueYTD = ytdInvoices.reduce((s: number, i: any) => s + (i.net_sales || 0), 0);

  const marginPct = revenueMTD > 0 ? (grossProfitMTD / revenueMTD) * 100 : 0;
  const targetVal = target?.revenue_target || 1;
  const achievementPct = (revenueMTD / targetVal) * 100;
  const outstandingAR = invoices.filter(inv => !inv.paid_date).reduce((s: number, inv: any) => s + (inv.net_sales || 0), 0);

  const finalStages = ['po_secured', 'invoice_issued', 'canceled', 'lost'];
  const openDeals = deals.filter(d => !finalStages.includes(d.stage));
  const weightedForecast = openDeals.reduce((s: number, d: any) => s + d.value * d.probability / 100, 0);

  const overdueInvoices = invoices.filter(inv => !inv.paid_date && new Date(inv.due_date) < now);
  const nearingDeals = deals.filter(d => {
    if (finalStages.includes(d.stage)) return false;
    const days = (new Date(d.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days <= 30 && days >= 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Sales Overview</h2>
        <p className="text-sm text-muted-foreground">Personal sales dashboard — {currentUser.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Actual Revenue YTD" value={formatIDRFull(revenueYTD)} icon={Banknote} status={achievementPct >= 100 ? 'green' : achievementPct >= 80 ? 'yellow' : 'red'} autoFitText className="bg-kpi-blue border-kpi-blue" />
        <KPICard label="Total Revenue MTD" value={formatIDRFull(revenueMTD)} icon={DollarSign} autoFitText className="bg-kpi-teal border-kpi-teal" />
        <KPICard label="Target Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} autoFitText className="bg-kpi-amber border-kpi-amber" />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} autoFitText className="bg-kpi-purple border-kpi-purple" />
        <KPICard label="Outstanding AR" value={formatIDRFull(outstandingAR)} icon={CreditCard} autoFitText className="bg-kpi-rose border-kpi-rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} icon={TrendingUp} autoFitText className="bg-kpi-emerald border-kpi-emerald" />
        <KPICard label="Weekly Activities" value={String(activities.length)} changeLabel={`${activities.length >= 5 ? 'On track' : 'Below minimum'}`} status={activities.length >= 5 ? 'green' : 'red'} icon={Clock} autoFitText className="bg-kpi-indigo border-kpi-indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Deals Nearing Close
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nearingDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals closing within 30 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Deal</TableHead>
                    <TableHead className="text-xs">Value</TableHead>
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-xs">Close Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nearingDeals.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                      <TableCell><StatusBadge status={d.probability >= 60 ? 'green' : d.probability >= 30 ? 'yellow' : 'red'} label={d.stage.replace('_', ' ')} /></TableCell>
                      <TableCell className="text-sm">{formatDate(d.expected_close_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-red" />
              Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue invoices. Great job!</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInvoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                      <TableCell className="text-sm">{formatIDR(inv.net_sales)}</TableCell>
                      <TableCell className="text-sm text-status-red">{formatDate(inv.due_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.slice(0, 5).map((act: any) => (
                <TableRow key={act.id}>
                  <TableCell className="text-sm">{formatDate(act.activity_date)}</TableCell>
                  <TableCell><StatusBadge status="green" label={act.type} /></TableCell>
                  <TableCell className="text-sm">{act.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
