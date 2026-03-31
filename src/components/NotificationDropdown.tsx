import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, AlertTriangle, Clock, TrendingDown, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'stagnant_deal' | 'overdue_invoice' | 'low_margin' | 'low_activity' | 'deletion_approved' | 'deletion_rejected';
  title: string;
  message: string;
  timestamp: Date;
  icon: typeof AlertTriangle;
  color: string;
  isDbNotif?: boolean;
  isRead?: boolean;
}

export function NotificationDropdown() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchNotifications();
    }
  }, [user, open]);

  async function fetchNotifications() {
    if (!user) return;
    setLoading(true);

    const notifs: Notification[] = [];
    const now = new Date();

    // 1. Stagnant deals (>14 days in stage)
    const { data: stagnantDeals } = await supabase
      .from('deals')
      .select('id, name, days_in_stage, stage')
      .gt('days_in_stage', 14)
      .not('stage', 'in', '("closed_won","closed_lost","canceled","lost")')
      .order('days_in_stage', { ascending: false })
      .limit(5);

    if (stagnantDeals) {
      stagnantDeals.forEach((deal) => {
        notifs.push({
          id: `deal-${deal.id}`,
          type: 'stagnant_deal',
          title: 'Deal Stagnan',
          message: `"${deal.name}" sudah ${deal.days_in_stage} hari di tahap ${deal.stage.replace('_', ' ')}`,
          timestamp: new Date(now.getTime() - deal.days_in_stage * 86400000),
          icon: Clock,
          color: 'text-amber-500',
        });
      });
    }

    // 2. Overdue invoices (>30 days past due)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, due_date, net_sales')
      .is('paid_date', null)
      .lt('due_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('due_date', { ascending: true })
      .limit(5);

    if (overdueInvoices) {
      overdueInvoices.forEach((inv) => {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / 86400000);
        notifs.push({
          id: `inv-${inv.id}`,
          type: 'overdue_invoice',
          title: 'Invoice Jatuh Tempo',
          message: `${inv.invoice_number} telat ${daysOverdue} hari (Rp ${Number(inv.net_sales).toLocaleString('id-ID')})`,
          timestamp: new Date(inv.due_date),
          icon: AlertTriangle,
          color: 'text-destructive',
        });
      });
    }

    // 3. Low margin deals (<17%)
    const { data: lowMarginInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, net_sales, gross_profit')
      .gt('net_sales', 0)
      .order('created_at', { ascending: false })
      .limit(50);

    if (lowMarginInvoices) {
      lowMarginInvoices
        .filter((inv) => inv.net_sales > 0 && (inv.gross_profit / inv.net_sales) * 100 < 17)
        .slice(0, 3)
        .forEach((inv) => {
          const margin = ((inv.gross_profit / inv.net_sales) * 100).toFixed(1);
          notifs.push({
            id: `margin-${inv.id}`,
            type: 'low_margin',
            title: 'Margin Rendah',
            message: `${inv.invoice_number} margin hanya ${margin}% (di bawah 17%)`,
            timestamp: now,
            icon: TrendingDown,
            color: 'text-orange-500',
          });
        });
    }

    // 4. Low weekly activity
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: activityCount } = await supabase
      .from('sales_activities')
      .select('id', { count: 'exact', head: true })
      .eq('sales_id', user.id)
      .gte('activity_date', weekAgo.toISOString().split('T')[0]);

    if (activityCount !== null && activityCount < 5) {
      notifs.push({
        id: 'activity-low',
        type: 'low_activity',
        title: 'Aktivitas Rendah',
        message: `Hanya ${activityCount} aktivitas minggu ini. Target minimum: 5 per minggu.`,
        timestamp: now,
        icon: Activity,
        color: 'text-blue-500',
      });
    }

    // 5. DB notifications (deal deletion approval/rejection)
    const { data: dbNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (dbNotifs) {
      dbNotifs.forEach((n: any) => {
        notifs.push({
          id: `db-${n.id}`,
          type: n.type as any,
          title: n.title,
          message: n.message,
          timestamp: new Date(n.created_at),
          icon: n.type === 'deletion_approved' ? CheckCircle2 : XCircle,
          color: n.type === 'deletion_approved' ? 'text-green-500' : 'text-destructive',
          isDbNotif: true,
          isRead: n.is_read,
        });
      });
    }

    setNotifications(notifs);
    setLoading(false);
  }

  const markAsRead = async (notifId: string) => {
    const dbId = notifId.replace('db-', '');
    await supabase.from('notifications').update({ is_read: true }).eq('id', dbId);
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  };

  const count = notifications.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center px-0.5">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Notifikasi</h4>
          {count > 0 && (
            <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-medium">
              {count} alert
            </span>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">Tidak ada notifikasi</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => {
                const Icon = notif.icon;
                return (
                  <div
                    key={notif.id}
                    className="flex gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-default"
                  >
                    <div className={`mt-0.5 ${notif.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{notif.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(notif.timestamp, { addSuffix: true, locale: id })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
