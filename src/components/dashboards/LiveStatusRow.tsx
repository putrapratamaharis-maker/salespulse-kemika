import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, ClipboardCheck, Activity, Circle, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/types/sales';

interface OnlineUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  presence_ref: string;
}

interface PendingApproval {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  deal_snapshot: any;
  requested_by: string;
  requester_name?: string;
}

interface RecentActivity {
  id: string;
  type: string;
  activity_date: string;
  notes: string | null;
  sales_name?: string;
  account_name?: string;
  created_at: string;
}

const activityTypeLabels: Record<string, string> = {
  call: '📞 Call',
  meeting: '🤝 Meeting',
  email: '📧 Email',
  visit: '🚗 Visit',
  proposal: '📄 Proposal',
};

export function LiveStatusRow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  // Track online presence via Supabase Realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: OnlineUser[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          const p = (presences as any[])[0];
          if (p) {
            users.push({
              user_id: key,
              full_name: p.full_name || 'User',
              avatar_url: p.avatar_url || null,
              presence_ref: p.presence_ref,
            });
          }
        });
        setOnlineUsers(users);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch pending approvals (deal deletion requests)
  useEffect(() => {
    if (!user) return;

    async function fetchPending() {
      const { data } = await supabase
        .from('deal_deletion_requests')
        .select('id, reason, status, created_at, deal_snapshot, requested_by')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        // Fetch requester names
        const userIds = [...new Set(data.map(d => d.requested_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

        setPendingApprovals(data.map(d => ({
          ...d,
          requester_name: nameMap.get(d.requested_by) || 'Unknown',
        })));
      } else {
        setPendingApprovals([]);
      }
    }

    fetchPending();

    // Realtime listener for new requests
    const channel = supabase
      .channel('pending-approvals')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deal_deletion_requests',
      }, () => { fetchPending(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch recent activities (real-time)
  useEffect(() => {
    if (!user) return;

    async function fetchActivities() {
      const { data } = await supabase
        .from('sales_activities')
        .select('id, type, activity_date, notes, sales_id, account_id, created_at')
        .order('created_at', { ascending: false })
        .limit(8);

      if (data && data.length > 0) {
        const salesIds = [...new Set(data.map(d => d.sales_id))];
        const accountIds = [...new Set(data.filter(d => d.account_id).map(d => d.account_id!))];

        const [profilesRes, accountsRes] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', salesIds),
          accountIds.length > 0
            ? (supabase.rpc as any)('get_accounts_basic')
            : { data: [] },
        ]);

        const nameMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.full_name]));
        const accMap = new Map(((accountsRes.data || []) as any[]).map((a: any) => [a.id as string, a.name as string]));

        setRecentActivities(data.map(d => ({
          ...d,
          sales_name: nameMap.get(d.sales_id) || 'Unknown',
          account_name: d.account_id ? accMap.get(d.account_id) || '—' : '—',
        })));
      } else {
        setRecentActivities([]);
      }
    }

    fetchActivities();

    // Realtime listener
    const channel = supabase
      .channel('live-activities')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sales_activities',
      }, () => { fetchActivities(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Online Users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            Online Users
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {onlineUsers.length} online
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {onlineUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Tidak ada user online.</p>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {onlineUsers.map((u) => (
                <div key={u.user_id} className="flex items-center gap-2">
                  <div className="relative">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                      {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                  </div>
                  <span className="text-xs font-medium truncate">{u.full_name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-amber-500" />
            Pending Approvals
            <div className="ml-auto flex items-center gap-1.5">
              {pendingApprovals.length > 0 && (
                <Badge variant="destructive" className="text-[10px] animate-pulse">
                  {pendingApprovals.length} pending
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => navigate('/deal-deletion-approval')}
                title="Buka halaman Approval"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingApprovals.length === 0 ? (
            <div className="flex flex-col items-center py-4 gap-1">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Semua sudah diproses ✓</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {pendingApprovals.map((a) => {
                const dealName = (a.deal_snapshot as any)?.name || 'Deal';
                return (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">Delete: {dealName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        by {a.requester_name} · {a.reason}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDateTime(a.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            Real-time Activity
            <span className="ml-auto flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground">Live</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Belum ada aktivitas terbaru.</p>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {recentActivities.map((a) => (
                <div key={a.id} className="flex items-start gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
                  <span className="text-sm shrink-0">{activityTypeLabels[a.type]?.slice(0, 2) || '📋'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      {a.sales_name} — {activityTypeLabels[a.type]?.slice(3) || a.type}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {a.account_name} {a.notes ? `· ${a.notes}` : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
