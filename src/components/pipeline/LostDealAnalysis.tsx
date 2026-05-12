import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Deal, LostReason, LOST_REASON_LABELS, formatIDRFull, formatDate } from '@/types/sales';
import { TrendingDown, Target, AlertTriangle, Trophy } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

interface LostDealAnalysisProps {
  deals: Deal[];
  getAccountName: (id: string) => string;
}

const REASON_COLORS: Record<string, string> = {
  price: '#ef4444',
  competitor: '#f97316',
  needs_mismatch: '#eab308',
  budget: '#8b5cf6',
  timing: '#06b6d4',
  no_response: '#6b7280',
  internal_decision: '#ec4899',
  other: '#94a3b8',
};

const WON_STAGES = ['po_secured', 'invoice_issued'];
const FINAL_STAGES = ['po_secured', 'invoice_issued', 'canceled', 'lost'];

export function LostDealAnalysis({ deals, getAccountName }: LostDealAnalysisProps) {
  const lostDeals = useMemo(() => deals.filter(d => d.stage === 'lost'), [deals]);
  const wonDeals = useMemo(() => deals.filter(d => WON_STAGES.includes(d.stage)), [deals]);
  const closedDeals = useMemo(() => deals.filter(d => FINAL_STAGES.includes(d.stage)), [deals]);

  const totalLostValue = useMemo(() => lostDeals.reduce((s, d) => s + d.value, 0), [lostDeals]);
  const totalWonValue = useMemo(() => wonDeals.reduce((s, d) => s + d.value, 0), [wonDeals]);

  const winRate = closedDeals.length > 0
    ? Math.round((wonDeals.length / closedDeals.length) * 100)
    : 0;
  const lossRate = 100 - winRate;

  const winLossPieData = [
    { name: 'Won', value: wonDeals.length, color: '#22c55e' },
    { name: 'Lost', value: lostDeals.length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const reasonData = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    lostDeals.forEach(d => {
      const key = d.lostReason || 'other';
      if (!counts[key]) counts[key] = { count: 0, value: 0 };
      counts[key].count += 1;
      counts[key].value += d.value;
    });
    return Object.entries(counts)
      .map(([reason, { count, value }]) => ({
        reason,
        label: LOST_REASON_LABELS[reason as LostReason] || reason,
        count,
        value,
        color: REASON_COLORS[reason] || '#94a3b8',
      }))
      .sort((a, b) => b.count - a.count);
  }, [lostDeals]);

  if (lostDeals.length === 0) {
    return (
      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <CardTitle className="text-sm font-semibold">Lost Deal Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Trophy className="h-10 w-10 mb-2 text-yellow-500 opacity-50" />
            <p className="text-sm font-medium">Belum ada deal yang lost</p>
            <p className="text-xs mt-1">Data akan muncul saat deal dipindahkan ke stage Lost</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Lost</p>
            <p className="text-2xl font-bold text-destructive mt-0.5">{lostDeals.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">deal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Nilai Lost</p>
            <p className="text-lg font-bold text-destructive mt-0.5 leading-tight">{formatIDRFull(totalLostValue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">potensi hilang</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate</p>
            <p className={`text-2xl font-bold mt-0.5 ${winRate >= 50 ? 'text-green-600' : winRate >= 30 ? 'text-yellow-600' : 'text-destructive'}`}>
              {winRate}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">dari {closedDeals.length} deal selesai</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Nilai Won</p>
            <p className="text-lg font-bold text-green-600 mt-0.5 leading-tight">{formatIDRFull(totalWonValue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">revenue terealisasi</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Win/Loss Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Win vs Lost Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={winLossPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {winLossPieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`${val} deal`, '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-1 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                Won: {winRate}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                Lost: {lossRate}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Lost Reasons Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Alasan Deal Lost</CardTitle>
          </CardHeader>
          <CardContent>
            {reasonData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={reasonData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    width={160}
                    tickFormatter={(val: string) => val.length > 22 ? val.slice(0, 22) + '…' : val}
                  />
                  <Tooltip
                    formatter={(val: number, _name, props) => [
                      `${val} deal — ${formatIDRFull(props.payload.value)}`,
                      'Jumlah',
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {reasonData.map((entry) => (
                      <Cell key={entry.reason} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">
                Belum ada data alasan
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lost Deals Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <CardTitle className="text-sm font-semibold">Daftar Deal Lost ({lostDeals.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Deal</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Account</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Nilai</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Alasan</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Catatan</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Est. Close</th>
                </tr>
              </thead>
              <tbody>
                {lostDeals.map((deal, idx) => (
                  <tr key={deal.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-4 py-2.5 font-medium max-w-[180px] truncate" title={deal.name}>{deal.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[150px] truncate">{getAccountName(deal.accountId)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-destructive">{formatIDRFull(deal.value)}</td>
                    <td className="px-4 py-2.5">
                      {deal.lostReason ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] whitespace-nowrap"
                          style={{ backgroundColor: `${REASON_COLORS[deal.lostReason]}20`, color: REASON_COLORS[deal.lostReason] }}
                        >
                          {LOST_REASON_LABELS[deal.lostReason]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={deal.lostNotes}>
                      {deal.lostNotes || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(deal.expectedCloseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
