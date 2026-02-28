import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, startOfWeek, addWeeks, isAfter, isBefore, addDays } from 'date-fns';

interface SalesActivity {
  id: string;
  type: string;
  activity_date: string;
}

const TYPE_COLORS: Record<string, string> = {
  call_chat: 'hsl(var(--primary))',
  visit: 'hsl(142, 71%, 45%)',
  online_meeting: 'hsl(217, 91%, 60%)',
  training: 'hsl(45, 93%, 47%)',
  demo: 'hsl(280, 67%, 55%)',
};

const LABELS: Record<string, string> = {
  call_chat: 'Call/Chat',
  visit: 'Visit',
  online_meeting: 'Online Meeting',
  training: 'Training',
  demo: 'Demo',
};

const TYPES = ['call_chat', 'visit', 'online_meeting', 'training', 'demo'] as const;

interface Props {
  activities: SalesActivity[];
}

export const WeeklyTrendChart = ({ activities }: Props) => {
  const chartData = useMemo(() => {
    if (activities.length === 0) return [];

    const now = new Date();
    const weeksToShow = 8;
    const startDate = startOfWeek(addWeeks(now, -(weeksToShow - 1)), { weekStartsOn: 1 });

    const weeks: { label: string; start: Date; end: Date }[] = [];
    for (let i = 0; i < weeksToShow; i++) {
      const wStart = addWeeks(startDate, i);
      const wEnd = addDays(wStart, 6);
      weeks.push({
        label: format(wStart, 'dd MMM'),
        start: wStart,
        end: wEnd,
      });
    }

    return weeks.map(w => {
      const row: Record<string, string | number> = { week: w.label };
      TYPES.forEach(t => { row[t] = 0; });

      activities.forEach(a => {
        const d = new Date(a.activity_date);
        if (!isBefore(d, w.start) && !isAfter(d, w.end)) {
          row[a.type] = (row[a.type] as number || 0) + 1;
        }
      });

      return row;
    });
  }, [activities]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Weekly Activity Trend (Last 8 Weeks)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: 12,
                color: 'hsl(var(--popover-foreground))',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {TYPES.map(type => (
              <Bar
                key={type}
                dataKey={type}
                name={LABELS[type]}
                fill={TYPE_COLORS[type]}
                stackId="a"
                radius={type === 'demo' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
