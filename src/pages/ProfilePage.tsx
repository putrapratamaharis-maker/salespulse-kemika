import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatIDR, formatPercent, getAchievementStatus, formatDate } from '@/types/sales';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, MapPin, Users, DollarSign, Target, Percent, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<any>(null);
  const [supervisor, setSupervisor] = useState<string>('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [target, setTarget] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const isSupervisor = ['manager', 'supervisor'].includes(currentUser.orgRole);

  useEffect(() => {
    async function fetchProfile() {
      if (!userId) return;
      setLoading(true);

      const [
        { data: prof },
        { data: invs },
        { data: dls },
        { data: tgts },
        { data: acts },
        { data: accts },
      ] = await Promise.all([
        supabase.from('profiles').select('*, positions(position_name)').eq('user_id', userId).single(),
        supabase.from('invoices').select('*').eq('sales_id', userId),
        supabase.from('deals').select('*').eq('sales_id', userId),
        supabase.from('targets').select('*').eq('user_id', userId),
        supabase.from('sales_activities').select('*').eq('sales_id', userId).order('activity_date', { ascending: false }),
        supabase.from('accounts').select('*').eq('sales_id', userId),
      ]);

      setProfile(prof);
      setInvoices(invs || []);
      setDeals(dls || []);
      setTarget(tgts?.[0] || null);
      setActivities(acts || []);
      setAccounts(accts || []);

      // Get supervisor name
      if (prof?.supervisor_id) {
        const { data: sup } = await supabase.from('profiles').select('full_name').eq('id', prof.supervisor_id).single();
        setSupervisor(sup?.full_name || '');
      }

      setLoading(false);
    }
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">User not found.</div>;
  }

  const revenue = invoices.reduce((s, i) => s + Number(i.net_sales), 0);
  const grossProfit = invoices.reduce((s, i) => s + Number(i.gross_profit), 0);
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const achievementPct = target ? (revenue / Number(target.revenue_target)) * 100 : 0;
  const pipelineValue = deals.filter(d => !['closed_won', 'closed_lost', 'canceled', 'lost'].includes(d.stage)).reduce((s, d) => s + Number(d.value), 0);

  const activityLabels: Record<string, string> = { call: 'Call', visit: 'Visit', email: 'Email', meeting: 'Meeting', follow_up: 'Follow Up', presentation: 'Presentation' };

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
          <h2 className="text-xl font-bold text-foreground">{profile.full_name}</h2>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {profile.region || '—'}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {profile.segment || '—'}</span>
            {supervisor && <span>Supervisor: {supervisor}</span>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="margin">Margin Compliance</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard label="Revenue MTD" value={formatIDR(revenue)} icon={DollarSign} className="bg-kpi-blue " borderAccent="border-l-kpi-blue-border" />
            <KPICard label="Achievement" value={formatPercent(achievementPct)} status={getAchievementStatus(achievementPct)} icon={Target} className="bg-kpi-teal " borderAccent="border-l-kpi-teal-border" />
            <KPICard label="Gross Margin" value={formatPercent(marginPct)} status={marginPct >= 17 ? 'green' : 'red'} icon={Percent} className="bg-kpi-amber " borderAccent="border-l-kpi-amber-border" />
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          {deals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada deal.</p>
          ) : (
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
                    <TableCell className="text-sm">{formatIDR(Number(d.value))}</TableCell>
                    <TableCell><StatusBadge status={d.probability >= 60 ? 'green' : d.probability >= 30 ? 'yellow' : 'red'} label={d.stage.replace('_', ' ')} /></TableCell>
                    <TableCell className="text-sm">{d.probability}%</TableCell>
                    <TableCell className="text-sm">{formatDate(d.expected_close_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada aktivitas.</p>
          ) : (
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
                    <TableCell className="text-sm">{formatDate(act.activity_date)}</TableCell>
                    <TableCell><StatusBadge status="green" label={activityLabels[act.type] || act.type} /></TableCell>
                    <TableCell className="text-sm">{act.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="margin" className="mt-4">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada invoice.</p>
          ) : (
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
                  const m = Number(inv.net_sales) > 0 ? (Number(inv.gross_profit) / Number(inv.net_sales)) * 100 : 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                      <TableCell className="text-sm">{formatIDR(Number(inv.net_sales))}</TableCell>
                      <TableCell className="text-sm">{formatIDR(Number(inv.gross_profit))}</TableCell>
                      <TableCell className="text-sm">{formatPercent(m)}</TableCell>
                      <TableCell><StatusBadge status={m >= 17 ? 'green' : 'red'} label={m >= 17 ? 'Yes' : 'No'} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada akun.</p>
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;
