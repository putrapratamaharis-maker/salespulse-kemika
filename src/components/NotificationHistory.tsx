import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Info, Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { id } from 'date-fns/locale';

interface NotifRecord {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  reference_type: string | null;
  reference_id: string | null;
}

const typeConfig: Record<string, { icon: typeof Info; color: string; label: string }> = {
  deletion_approved: { icon: CheckCircle2, color: 'text-green-500', label: 'Disetujui' },
  deletion_rejected: { icon: XCircle, color: 'text-destructive', label: 'Ditolak' },
  info: { icon: Info, color: 'text-blue-500', label: 'Info' },
};

export function NotificationHistory() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotifRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (user) fetchNotifications(0);
  }, [user]);

  async function fetchNotifications(pageNum: number) {
    if (!user) return;
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      if (pageNum === 0) {
        setNotifications(data as NotifRecord[]);
      } else {
        setNotifications(prev => [...prev, ...(data as NotifRecord[])]);
      }
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
    }
    setLoading(false);
  }

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            Riwayat Notifikasi
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {unreadCount} belum dibaca
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Semua notifikasi yang pernah Anda terima</CardDescription>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" />
            Tandai Semua Dibaca
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">Belum ada notifikasi</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-1">
              {notifications.map((notif) => {
                const config = typeConfig[notif.type] || typeConfig.info;
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    className={`flex gap-3 p-3 rounded-lg transition-colors cursor-default ${
                      notif.is_read ? 'opacity-60' : 'bg-accent/30'
                    }`}
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                  >
                    <div className={`mt-0.5 shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{notif.title}</p>
                        {!notif.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/60">
                          {format(new Date(notif.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">
                          ({formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })})
                        </span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => fetchNotifications(page + 1)}
                  disabled={loading}
                >
                  {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
