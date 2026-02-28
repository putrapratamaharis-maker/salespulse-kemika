import { useMemo } from 'react';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SalesActivity {
  id: string;
  type: string;
  activity_date: string;
}

const activityLabels: Record<string, string> = {
  call_chat: 'Call/Chat',
  visit: 'Visit',
  online_meeting: 'Online Meeting',
  training: 'Training',
  demo: 'Demo',
};

interface MonthlyStatsProps {
  activities: SalesActivity[];
}

export const MonthlyStats = ({ activities }: MonthlyStatsProps) => {
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(startOfMonth(now), i);
      months.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') });
    }

    const grouped: Record<string, Record<string, number>> = {};
    for (const m of months) {
      grouped[m.key] = {};
    }

    for (const a of activities) {
      const mKey = a.activity_date.substring(0, 7);
      if (grouped[mKey]) {
        grouped[mKey][a.type] = (grouped[mKey][a.type] || 0) + 1;
      }
    }

    return months.map((m, idx) => {
      const types = grouped[m.key];
      const total = Object.values(types).reduce((s, v) => s + v, 0);
      const prevKey = idx > 0 ? months[idx - 1].key : null;
      const prevTotal = prevKey ? Object.values(grouped[prevKey]).reduce((s, v) => s + v, 0) : null;
      return { ...m, types, total, prevTotal };
    });
  }, [activities]);

  const types = Object.keys(activityLabels);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Monthly Statistics (Last 6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Month</TableHead>
                {types.map(t => (
                  <TableHead key={t} className="text-xs text-center">{activityLabels[t]}</TableHead>
                ))}
                <TableHead className="text-xs text-center">Total</TableHead>
                <TableHead className="text-xs text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map(m => {
                const trend = m.prevTotal !== null ? m.total - m.prevTotal : null;
                return (
                  <TableRow key={m.key}>
                    <TableCell className="text-sm font-medium">{m.label}</TableCell>
                    {types.map(t => (
                      <TableCell key={t} className="text-sm text-center text-muted-foreground">
                        {m.types[t] || 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-sm text-center font-bold">{m.total}</TableCell>
                    <TableCell className="text-center">
                      {trend === null ? (
                        <Minus className="h-4 w-4 text-muted-foreground inline" />
                      ) : trend > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-green-600">
                          <TrendingUp className="h-3.5 w-3.5" /> +{trend}
                        </span>
                      ) : trend < 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-red-500">
                          <TrendingDown className="h-3.5 w-3.5" /> {trend}
                        </span>
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground inline" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
