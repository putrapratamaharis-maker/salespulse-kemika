import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatIDRFull } from '@/types/sales';
import { Target } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine,
} from 'recharts';

interface DealRow {
  id: string;
  value: number;
  probability: number;
  stage: string;
  expected_close_date: string;
}

interface InvoiceRow {
  net_sales: number;
  issue_date: string;
}

interface ForecastAccuracyTrackerProps {
  deals: DealRow[];
  invoices: InvoiceRow[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const REVENUE_STAGES = ['po_secured', 'invoice_issued'];

function getPast6Months(): { year: number; month: number; label: string; key: string }[] {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1, // 1-indexed
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return result;
}

function accuracyColor(pct: number) {
  if (pct >= 90) return 'bg-green-100 text-green-700';
  if (pct >= 60) return 'bg-yellow-100 text-yellow-700';
  if (pct > 0)   return 'bg-red-100 text-red-700';
  return 'bg-muted text-muted-foreground';
}

export function ForecastAccuracyTracker({ deals, invoices }: ForecastAccuracyTrackerProps) {
  const months = useMemo(() => getPast6Months(), []);

  const rows = useMemo(() => {
    return months.map(({ year, month, label, key }) => {
      // Forecast = deals yang expected_close_date jatuh di bulan ini (open or closed)
      const forecastDeals = deals.filter(d => {
        const dc = new Date(d.expected_close_date);
        return dc.getFullYear() === year && dc.getMonth() + 1 === month;
      });
      const forecast = forecastDeals.reduce((s, d) => s + d.value * (d.probability / 100), 0);

      // Actual = invoices yang issue_date di bulan ini
      const actual = invoices
        .filter(i => {
          const dt = new Date(i.issue_date);
          return dt.getFullYear() === year && dt.getMonth() + 1 === month;
        })
        .reduce((s, i) => s + Number(i.net_sales), 0);

      const accuracyPct = forecast > 0 ? Math.round((actual / forecast) * 100) : null;

      return { key, label, forecast, actual, accuracyPct, dealCount: forecastDeals.length };
    });
  }, [months, deals, invoices]);

  const avgAccuracy = useMemo(() => {
    const withData = rows.filter(r => r.accuracyPct !== null);
    if (withData.length === 0) return null;
    return Math.round(withData.reduce((s, r) => s + (r.accuracyPct ?? 0), 0) / withData.length);
  }, [rows]);

  const chartData = rows.map(r => ({
    name: r.label,
    Forecast: Math.round(r.forecast),
    Aktual: Math.round(r.actual),
  }));

  const formatAxis = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return String(val);
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Forecast Accuracy Tracker
            <span className="text-xs font-normal text-muted-foreground">6 bulan terakhir</span>
          </CardTitle>
          {avgAccuracy !== null && (
            <Badge className={`text-xs ${accuracyColor(avgAccuracy)} border-0`}>
              Avg Akurasi: {avgAccuracy}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        {/* Bar Chart */}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={formatAxis} tick={{ fontSize: 10 }} width={45} />
            <Tooltip
              formatter={(val: number, name: string) => [formatIDRFull(val), name]}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Forecast" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} opacity={0.7} />
            <Bar dataKey="Aktual" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Detail Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Bulan</th>
                <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Deals (qty)</th>
                <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Weighted Forecast</th>
                <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Aktual (Invoice)</th>
                <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Akurasi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.key} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="py-2 text-sm font-medium">{row.label}</td>
                  <td className="py-2 text-right text-sm tabular-nums text-muted-foreground">{row.dealCount}</td>
                  <td className="py-2 text-right text-sm tabular-nums">
                    {row.forecast > 0 ? formatIDRFull(row.forecast) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2 text-right text-sm tabular-nums font-semibold">
                    {row.actual > 0 ? formatIDRFull(row.actual) : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="py-2 text-center">
                    {row.accuracyPct !== null ? (
                      <Badge className={`text-[10px] px-2 border-0 ${accuracyColor(row.accuracyPct)}`}>
                        {row.accuracyPct}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          * Forecast = weighted (nilai × probabilitas) dari deals dengan estimasi close di bulan tersebut.
          Aktual = total invoice yang terbit di bulan tersebut.
        </p>
      </CardContent>
    </Card>
  );
}
