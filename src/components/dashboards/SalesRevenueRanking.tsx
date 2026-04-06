import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Loader2 } from 'lucide-react';
import { formatNumIDR, formatPercent } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';

interface SalesRanking {
  name: string;
  segment: string;
  revenue: number;
  target: number;
  achievementPct: number;
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-500 font-bold">🥇</span>;
  if (rank === 2) return <span className="text-gray-400 font-bold">🥈</span>;
  if (rank === 3) return <span className="text-amber-700 font-bold">🥉</span>;
  return <span className="text-muted-foreground font-bold">{rank}</span>;
}

function RankingTable({ data, totalRevenue }: { data: SalesRanking[]; totalRevenue: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs w-10">#</TableHead>
          <TableHead className="text-xs">Sales Person</TableHead>
          <TableHead className="text-xs">Segment</TableHead>
          <TableHead className="text-xs text-right">Revenue (Rp)</TableHead>
          <TableHead className="text-xs text-right">Target (Rp)</TableHead>
          <TableHead className="text-xs text-right">Achievement</TableHead>
          <TableHead className="text-xs text-right">Kontribusi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((sp, i) => {
          const kontribusi = totalRevenue > 0 ? (sp.revenue / totalRevenue) * 100 : 0;
          return (
            <TableRow key={sp.name + i}>
              <TableCell className="text-xs"><RankMedal rank={i + 1} /></TableCell>
              <TableCell className="text-xs font-medium">{sp.name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{sp.segment}</TableCell>
              <TableCell className="text-xs text-right font-semibold">{formatIDRFull(sp.revenue)}</TableCell>
              <TableCell className="text-xs text-right text-muted-foreground">{formatIDRFull(sp.target)}</TableCell>
              <TableCell className="text-xs text-right">
                <span className={sp.achievementPct >= 100 ? 'text-status-green font-semibold' : sp.achievementPct >= 80 ? 'text-status-yellow font-semibold' : 'text-status-red font-semibold'}>
                  {formatPercent(sp.achievementPct)}
                </span>
              </TableCell>
              <TableCell className="text-xs text-right text-muted-foreground">{formatPercent(kontribusi)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function SalesRevenueRanking() {
  const [loading, setLoading] = useState(true);
  const [mtdData, setMtdData] = useState<SalesRanking[]>([]);
  const [ytdData, setYtdData] = useState<SalesRanking[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentYear = now.getFullYear();

      const [{ data: profiles }, { data: invoices }, { data: targets }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, segment'),
        supabase.from('invoices').select('sales_id, net_sales, issue_date'),
        supabase.from('targets').select('user_id, revenue_target, month'),
      ]);

      const profileList = profiles || [];
      const invoiceList = invoices || [];
      const targetList = targets || [];

      const buildRanking = (filterMonth?: string): SalesRanking[] => {
        return profileList.map(p => {
          const inv = filterMonth
            ? invoiceList.filter(i => i.sales_id === p.user_id && i.issue_date.startsWith(filterMonth))
            : invoiceList.filter(i => i.sales_id === p.user_id && i.issue_date.startsWith(String(currentYear)));
          const revenue = inv.reduce((s, i) => s + (i.net_sales || 0), 0);

          const tgts = filterMonth
            ? targetList.filter(t => t.user_id === p.user_id && t.month === filterMonth)
            : targetList.filter(t => t.user_id === p.user_id);
          const target = tgts.reduce((s, t) => s + (t.revenue_target || 0), 0);

          return {
            name: p.full_name,
            segment: p.segment || '',
            revenue,
            target,
            achievementPct: target > 0 ? (revenue / target) * 100 : 0,
          };
        }).filter(r => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
      };

      setMtdData(buildRanking(currentMonth));
      setYtdData(buildRanking());
      setLoading(false);
    };
    fetchData();
  }, []);

  const mtdTotal = mtdData.reduce((s, d) => s + d.revenue, 0);
  const ytdTotal = ytdData.reduce((s, d) => s + d.revenue, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Sales Revenue Ranking — MTD
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mtdData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada data.</p>
          ) : (
            <RankingTable data={mtdData} totalRevenue={mtdTotal} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" />
            Sales Revenue Ranking — YTD
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ytdData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada data.</p>
          ) : (
            <RankingTable data={ytdData} totalRevenue={ytdTotal} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
