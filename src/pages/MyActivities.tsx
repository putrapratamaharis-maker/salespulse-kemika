import { StatusBadge } from '@/components/StatusBadge';
import { KPICard } from '@/components/KPICard';
import { useAppContext } from '@/context/AppContext';
import { formatDate } from '@/types/sales';
import { getUserActivities, mockAccounts } from '@/data/mockData';
import { Activity, Phone, Users, Mail, MapPin, FileText, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const activityIcons: Record<string, React.ElementType> = {
  call: Phone,
  meeting: Users,
  email: Mail,
  visit: MapPin,
  proposal: FileText,
};

const activityColors: Record<string, 'green' | 'yellow' | 'red'> = {
  call: 'green',
  meeting: 'green',
  email: 'yellow',
  visit: 'green',
  proposal: 'yellow',
};

const MyActivities = () => {
  const { currentUser } = useAppContext();
  const activities = getUserActivities(currentUser.id);

  const getAccountName = (accountId: string) =>
    mockAccounts.find(a => a.id === accountId)?.name || accountId;

  // Activity summary
  const typeCounts = activities.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const thisWeek = activities.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });

  const minWeeklyTarget = 5;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Activities</h2>
        <p className="text-sm text-muted-foreground">Activity log & tracking — {currentUser.name}</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Activities"
          value={String(activities.length)}
          icon={Activity}
          autoFitText
        />
        <KPICard
          label="This Week"
          value={String(thisWeek.length)}
          status={thisWeek.length >= minWeeklyTarget ? 'green' : 'red'}
          changeLabel={thisWeek.length >= minWeeklyTarget ? 'On track' : `Min ${minWeeklyTarget}/week`}
          icon={Clock}
          autoFitText
        />
        <KPICard
          label="Meetings"
          value={String(typeCounts['meeting'] || 0)}
          icon={Users}
          autoFitText
        />
        <KPICard
          label="Visits"
          value={String(typeCounts['visit'] || 0)}
          icon={MapPin}
          autoFitText
        />
      </div>

      {/* Activity Type Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Activity by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {['call', 'meeting', 'email', 'visit', 'proposal'].map(type => {
              const Icon = activityIcons[type];
              const count = typeCounts[type] || 0;
              return (
                <div key={type} className="flex flex-col items-center p-3 rounded-lg bg-secondary/50">
                  <Icon className="h-5 w-5 text-muted-foreground mb-1" />
                  <span className="text-lg font-bold text-foreground">{count}</span>
                  <span className="text-xs text-muted-foreground capitalize">{type}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Full Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map(act => {
                  const Icon = activityIcons[act.type] || Activity;
                  return (
                    <TableRow key={act.id}>
                      <TableCell className="text-sm">{formatDate(act.date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <StatusBadge status={activityColors[act.type] || 'green'} label={act.type} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{getAccountName(act.accountId)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{act.notes}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyActivities;
