import { useParams, useNavigate } from 'react-router-dom';
import { mockUsers, getUserInvoices, getUserDeals, getUserTarget, getUserActivities, mockAccounts, mockCoachingNotes } from '@/data/mockData';
import { useAppContext } from '@/context/AppContext';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatPercent, getAchievementStatus, formatDate } from '@/types/sales';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, MapPin, Users, DollarSign, Target, Percent } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAppContext();

  const user = mockUsers.find(u => u.id === userId);
  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">User not found.</div>;
  }

  const invoices = getUserInvoices(user.id);
  const deals = getUserDeals(user.id);
  const target = getUserTarget(user.id);
  const activities = getUserActivities(user.id);
  const accounts = mockAccounts.filter(a => a.salesId === user.id);
  const coachingNotes = mockCoachingNotes.filter(cn => cn.salesId === user.id);
  const supervisor = mockUsers.find(u => u.id === user.supervisorId);

  const revenue = invoices.reduce((s, i) => s + i.netSales, 0);
  const grossProfit = invoices.reduce((s, i) => s + i.grossProfit, 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const achievementPct = target ? (revenue / target.revenueTarget) * 100 : 0;
  const pipelineValue = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);

  const isSupervisor = ['sales_manager', 'supervisor'].includes(currentUser.orgRole);

  // Fake trend data
  const trendData = [
    { month: 'Sep', revenue: 380 },
    { month: 'Oct', revenue: 420 },
    { month: 'Nov', revenue: 350 },
    { month: 'Dec', revenue: 510 },
    { month: 'Jan', revenue: 450 },
    { month: 'Feb', revenue: Math.round(revenue / 1_000_000) },
  ];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-start gap-4 p-5 bg-card rounded-lg border">
        <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center">
          <User className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {user.region}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {user.segment}</span>
            {supervisor && <span>Supervisor: {supervisor.name}</span>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="margin">Margin Compliance</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          {isSupervisor && <TabsTrigger value="coaching">Coaching Notes</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard label="Revenue MTD" value={formatIDR(revenue)} icon={DollarSign} />
            <KPICard label="Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} />
            <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} />
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--accent))', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Deal</TableHead>
                <TableHead className="text-xs">Value</TableHead>
                <TableHead className="text-xs">Stage</TableHead>
                <TableHead className="text-xs">Probability</TableHead>
                <TableHead className="text-xs">Close Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                  <TableCell><StatusBadge status={d.probability >= 60 ? 'green' : d.probability >= 30 ? 'yellow' : 'red'} label={d.stage.replace('_', ' ')} /></TableCell>
                  <TableCell className="text-sm">{d.probability}%</TableCell>
                  <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map(act => (
                <TableRow key={act.id}>
                  <TableCell className="text-sm">{formatDate(act.date)}</TableCell>
                  <TableCell><StatusBadge status="green" label={act.type} /></TableCell>
                  <TableCell className="text-sm">{act.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="margin" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Invoice</TableHead>
                <TableHead className="text-xs">Net Sales</TableHead>
                <TableHead className="text-xs">GP</TableHead>
                <TableHead className="text-xs">Margin %</TableHead>
                <TableHead className="text-xs">Compliant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => {
                const m = inv.netSales > 0 ? (inv.grossProfit / inv.netSales) * 100 : 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.netSales)}</TableCell>
                    <TableCell className="text-sm">{formatIDR(inv.grossProfit)}</TableCell>
                    <TableCell className="text-sm">{formatPercent(m)}</TableCell>
                    <TableCell><StatusBadge status={m >= 17 ? 'green' : 'red'} label={m >= 17 ? 'Yes' : 'No'} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs">Segment</TableHead>
                <TableHead className="text-xs">Region</TableHead>
                <TableHead className="text-xs">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell className="text-sm font-medium">{acc.name}</TableCell>
                  <TableCell className="text-sm">{acc.segment}</TableCell>
                  <TableCell className="text-sm">{acc.region}</TableCell>
                  <TableCell className="text-sm">{acc.type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {isSupervisor && (
          <TabsContent value="coaching" className="mt-4">
            {coachingNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No coaching notes yet.</p>
            ) : (
              <div className="space-y-3">
                {coachingNotes.map(cn => (
                  <Card key={cn.id}>
                    <CardContent className="pt-4">
                      <div className="text-xs text-muted-foreground mb-1">{formatDate(cn.date)}</div>
                      <p className="text-sm">{cn.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ProfilePage;
