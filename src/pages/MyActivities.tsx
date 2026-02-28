import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { Activity, Phone, Users, Mail, MapPin, FileText, Clock, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface SalesActivity {
  id: string;
  sales_id: string;
  type: string;
  activity_date: string;
  account_id: string | null;
  notes: string | null;
  next_action_date: string | null;
  created_at: string;
}

interface Account {
  id: string;
  name: string;
}

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

const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'visit', 'proposal'] as const;

const MyActivities = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formType, setFormType] = useState<string>('call');
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formAccountId, setFormAccountId] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [formNextActionDate, setFormNextActionDate] = useState('');

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [actRes, accRes] = await Promise.all([
      supabase
        .from('sales_activities')
        .select('*')
        .eq('sales_id', user.id)
        .order('activity_date', { ascending: false }),
      supabase.from('accounts').select('id, name'),
    ]);

    if (actRes.data) setActivities(actRes.data as SalesActivity[]);
    if (accRes.data) setAccounts(accRes.data as Account[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const resetForm = () => {
    setFormType('call');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormAccountId('');
    setFormNotes('');
    setFormNextActionDate('');
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    const { error } = await supabase.from('sales_activities').insert({
      sales_id: user.id,
      type: formType,
      activity_date: formDate,
      account_id: formAccountId || null,
      notes: formNotes || null,
      next_action_date: formNextActionDate || null,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Activity added', description: 'Your activity has been recorded.' });
    resetForm();
    setDialogOpen(false);
    fetchData();
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return '-';
    return accounts.find(a => a.id === accountId)?.name || accountId;
  };

  const typeCounts = activities.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const thisWeek = activities.filter(a => {
    const d = new Date(a.activity_date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });

  const minWeeklyTarget = 5;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Activities</h2>
          <p className="text-sm text-muted-foreground">
            Activity log & tracking — {profile?.full_name || user?.email}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Activity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account (optional)</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Brief description of the activity..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label>Next Action Date (optional)</Label>
                <Input type="date" value={formNextActionDate} onChange={e => setFormNextActionDate(e.target.value)} />
              </div>
              <Button onClick={handleSubmit} disabled={submitting || !formDate} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Activity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Activities" value={String(activities.length)} icon={Activity} autoFitText />
        <KPICard
          label="This Week"
          value={String(thisWeek.length)}
          status={thisWeek.length >= minWeeklyTarget ? 'green' : 'red'}
          changeLabel={thisWeek.length >= minWeeklyTarget ? 'On track' : `Min ${minWeeklyTarget}/week`}
          icon={Clock}
          autoFitText
        />
        <KPICard label="Meetings" value={String(typeCounts['meeting'] || 0)} icon={Users} autoFitText />
        <KPICard label="Visits" value={String(typeCounts['visit'] || 0)} icon={MapPin} autoFitText />
      </div>

      {/* Activity Type Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Activity by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {ACTIVITY_TYPES.map(type => {
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
            <p className="text-sm text-muted-foreground">No activities recorded yet. Click "Add Activity" to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                  <TableHead className="text-xs">Next Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map(act => {
                  const Icon = activityIcons[act.type] || Activity;
                  return (
                    <TableRow key={act.id}>
                      <TableCell className="text-sm">
                        {format(new Date(act.activity_date), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <StatusBadge status={activityColors[act.type] || 'green'} label={act.type} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{getAccountName(act.account_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{act.notes || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {act.next_action_date ? format(new Date(act.next_action_date), 'dd MMM yyyy') : '-'}
                      </TableCell>
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
