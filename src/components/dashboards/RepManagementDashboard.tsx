import { useState, useEffect } from 'react';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDRFull, formatNumIDR, formatPercent } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, MapPin, TrendingDown, CreditCard, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ChannelData {
  channel: string;
  revenue: number;
  marginPct: number;
  outstanding: number;
  pipeline: number;
  accountCount: number;
}

export function RepManagementDashboard() {
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [regions, setRegions] = useState<{ region: string; count: number }[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [{ data: accounts }, { data: invoices }, { data: deals }] = await Promise.all([
        supabase.from('accounts').select('id, type, region'),
        supabase.from('invoices').select('account_id, net_sales, gross_profit, paid_date'),
        supabase.from('deals').select('account_id, value, stage'),
      ]);

      const allAccounts = accounts || [];
      const allInvoices = invoices || [];
      const allDeals = deals || [];

      // Channel breakdown by account type
      const channels = [...new Set(allAccounts.map(a => a.type).filter(Boolean))];
      const chData: ChannelData[] = channels.map(ch => {
        const accs = allAccounts.filter(a => a.type === ch);
        const accIds = new Set(accs.map(a => a.id));
        const invs = allInvoices.filter(inv => accIds.has(inv.account_id));
        const revenue = invs.reduce((s, i) => s + Number(i.net_sales), 0);
        const grossProfit = invs.reduce((s, i) => s + Number(i.gross_profit), 0);
        const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
        const outstanding = invs.filter(inv => !inv.paid_date).reduce((s, inv) => s + Number(inv.net_sales), 0);
        const dls = allDeals.filter(d => accIds.has(d.account_id));
        const pipeline = dls.filter(d => !['closed_won', 'closed_lost', 'canceled', 'lost'].includes(d.stage)).reduce((s, d) => s + Number(d.value), 0);
        return { channel: ch, revenue, marginPct, outstanding, pipeline, accountCount: accs.length };
      });
      setChannelData(chData);

      // Region coverage
      const regMap = new Map<string, number>();
      allAccounts.forEach(a => {
        const r = a.region || 'Unknown';
        if (r) regMap.set(r, (regMap.get(r) || 0) + 1);
      });
      setRegions(Array.from(regMap, ([region, count]) => ({ region, count })).filter(r => r.region && r.region !== '').sort((a, b) => b.count - a.count));

      setLoading(false);
    }
    fetchData();
  }, []);

  const totalRevenue = channelData.reduce((s, c) => s + c.revenue, 0);
  const totalOutstanding = channelData.reduce((s, c) => s + c.outstanding, 0);
  const totalPipeline = channelData.reduce((s, c) => s + c.pipeline, 0);

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
        <h2 className="text-xl font-bold text-foreground">Channel Performance</h2>
        <p className="text-sm text-muted-foreground">Revenue and margin by representative channel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={formatIDRFull(totalRevenue)} icon={DollarSign} autoFitText className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" />
        <KPICard label="Total Outstanding" value={formatIDRFull(totalOutstanding)} icon={CreditCard} autoFitText className="bg-kpi-teal " borderAccent="border-l-kpi-teal-border" />
        <KPICard label="Total Pipeline" value={formatIDRFull(totalPipeline)} icon={TrendingDown} autoFitText className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" />
        <KPICard label="Active Regions" value={String(regions.length)} icon={MapPin} autoFitText className="bg-kpi-purple " borderAccent="border-l-kpi-purple-border" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Channel Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {channelData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada data channel.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs">Accounts</TableHead>
                  <TableHead className="text-xs">Revenue MTD (Rp)</TableHead>
                  <TableHead className="text-xs">Margin %</TableHead>
                  <TableHead className="text-xs">Outstanding AR (Rp)</TableHead>
                  <TableHead className="text-xs">Pipeline (Rp)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelData.map(c => (
                  <TableRow key={c.channel}>
                    <TableCell className="text-sm font-medium">{c.channel}</TableCell>
                    <TableCell className="text-sm">{c.accountCount}</TableCell>
                    <TableCell className="text-sm font-medium">{formatNumIDR(c.revenue)}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.marginPct >= 17 ? 'green' : 'red'} label={formatPercent(c.marginPct)} />
                    </TableCell>
                    <TableCell className="text-sm">{formatIDRFull(c.outstanding)}</TableCell>
                    <TableCell className="text-sm">{formatIDRFull(c.pipeline)}</TableCell>
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
            <MapPin className="h-4 w-4 text-accent" />
            Region Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {regions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada data region.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {regions.map(r => (
                <div key={r.region} className="p-3 rounded-lg bg-secondary">
                  <div className="text-sm font-semibold text-foreground">{r.region}</div>
                  <div className="text-xs text-muted-foreground">{r.count} accounts</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
