import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { useAppContext } from '@/context/AppContext';
import { formatIDRFull, formatPercent, getAchievementStatus, formatDate } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { Target, TrendingUp, DollarSign, Percent, BarChart3, Clock, AlertTriangle, CreditCard, Banknote, Loader2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MONTH_OPTIONS = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

const currentDate = new Date();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - 2 + i));

export function SalesPersonDashboard() {
  const { currentUser } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [target, setTarget] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  // Year/Month filter state
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1));

  const selYear = Number(selectedYear);
  const selMonth = Number(selectedMonth);
  const monthStr = `${selectedYear}-${String(selMonth).padStart(2, '0')}`;
  const monthName = MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label || '';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const sid = currentUser.id;
      const [invRes, dealRes, tgtRes, actRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('sales_id', sid),
        supabase.from('deals').select('*').eq('sales_id', sid),
        supabase.from('targets').select('*').eq('user_id', sid).eq('month', monthStr).limit(1),
        supabase.from('sales_activities').select('*').eq('sales_id', sid).order('activity_date', { ascending: false }).limit(10),
      ]);
      setInvoices(invRes.data || []);
      setDeals(dealRes.data || []);
      setTarget(tgtRes.data?.[0] || null);
      setActivities(actRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [currentUser.id, monthStr]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Revenue from deals at po_secured AND invoice_issued
  const revenueStages = ['po_secured', 'invoice_issued'];
  const wonDeals = deals.filter(d => revenueStages.includes(d.stage));

  const mtdWon = wonDeals.filter(d => {
    const dt = new Date(d.expected_close_date);
    return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
  });
  const revenueMTD = mtdWon.reduce((s: number, d: any) => s + (d.value || 0), 0);

  const ytdWon = wonDeals.filter(d => new Date(d.expected_close_date).getFullYear() === currentYear);
  const revenueYTD = ytdWon.reduce((s: number, d: any) => s + (d.value || 0), 0);

  const mtdInvoices = invoices.filter(i => {
    const d = new Date(i.issue_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const grossProfitMTD = mtdInvoices.reduce((s: number, i: any) => s + (i.gross_profit || 0), 0);

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
        <KPICard label="Actual Revenue YTD" value={formatIDRFull(revenueYTD)} icon={Banknote} status={achievementPct >= 100 ? 'green' : achievementPct >= 80 ? 'yellow' : 'red'} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" tooltip="Total nilai deal Anda pada tahap PO Secured DAN Invoice Issued di tahun berjalan, berdasarkan PO/Won/Closed Date" />
        <KPICard label="ACTUAL REVENUE MTD" value={formatIDRFull(revenueMTD)} icon={DollarSign} autoFitText className="bg-kpi-teal " borderAccent="border-l-kpi-teal-border" tooltip="Total nilai deal Anda pada tahap PO Secured DAN Invoice Issued di bulan berjalan, berdasarkan PO/Won/Closed Date" />
        <KPICard label="Target Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} autoFitText className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" tooltip="Revenue MTD ÷ Revenue Target × 100%" />
        <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} autoFitText className="bg-kpi-purple " borderAccent="border-l-kpi-purple-border" tooltip="Gross Profit ÷ Net Sales × 100% dari invoice Anda. Threshold hijau ≥ 17%" />
        <KPICard label="Outstanding AR" value={formatIDRFull(outstandingAR)} icon={CreditCard} autoFitText className="bg-kpi-rose " borderAccent="border-l-kpi-rose-border" tooltip="Total net_sales dari invoice Anda yang belum dibayar (paid_date kosong)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KPICard label="Weighted Forecast" value={formatIDRFull(weightedForecast)} icon={TrendingUp} autoFitText className="bg-kpi-emerald " borderAccent="border-l-kpi-emerald-border" tooltip="Σ (value × probability / 100) dari deal aktif Anda, tidak termasuk PO Secured, Invoice Issued, Canceled, Lost" />
        <KPICard label="Weekly Activities" value={String(activities.length)} changeLabel={`${activities.length >= 5 ? 'On track' : 'Below minimum'}`} status={activities.length >= 5 ? 'green' : 'red'} icon={Clock} autoFitText className="bg-kpi-indigo " borderAccent="border-l-kpi-indigo-border" tooltip="Jumlah aktivitas sales Anda dalam 10 terakhir. Minimum 5 aktivitas per minggu" />
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
                      <TableCell className="text-sm">{formatIDRFull(d.value)}</TableCell>
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
                      <TableCell className="text-sm">{formatIDRFull(inv.net_sales)}</TableCell>
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
