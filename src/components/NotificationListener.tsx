import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { playNotificationSound } from '@/lib/notificationSound';
import type { NotificationPreferences } from '@/hooks/useNotificationPreferences';

const DEFAULT_PREFS: NotificationPreferences = {
  stagnant_deal: true,
  overdue_invoice: true,
  low_margin: true,
  low_activity: true,
  deletion_alerts: true,
  browser_push: true,
  sound_enabled: true,
};

async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showBrowserNotification(title: string, body: string, enabled: boolean) {
  if (!enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: `notif-${Date.now()}` });
  } catch { /* silent */ }
}

export function NotificationListener() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permissionRequested = useRef(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);

  // Fetch preferences
  useEffect(() => {
    if (!user) return;
    supabase
      .from('notification_preferences' as any)
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            stagnant_deal: (data as any).stagnant_deal,
            overdue_invoice: (data as any).overdue_invoice,
            low_margin: (data as any).low_margin,
            low_activity: (data as any).low_activity,
            deletion_alerts: (data as any).deletion_alerts,
            browser_push: (data as any).browser_push,
            sound_enabled: (data as any).sound_enabled,
          });
        }
      });
  }, [user]);

  // Request permission
  useEffect(() => {
    if (!permissionRequested.current && user && prefs.browser_push) {
      permissionRequested.current = true;
      requestNotificationPermission();
    }
  }, [user, prefs.browser_push]);

  const notify = (title: string, message: string, type: 'success' | 'warning' | 'error' = 'warning') => {
    if (type === 'success') {
      toast.success(title, { description: message, duration: 6000 });
    } else if (type === 'error') {
      toast.error(title, { description: message, duration: 6000 });
    } else {
      toast.warning(title, { description: message, duration: 8000 });
    }
    showBrowserNotification(title, message, prefs.browser_push);
    if (prefs.sound_enabled) playNotificationSound();
  };

  // Realtime DB notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as { title: string; message: string; type: string };
        if (!prefs.deletion_alerts && (n.type === 'deletion_approved' || n.type === 'deletion_rejected')) return;
        const t = n.type === 'deletion_approved' ? 'success' : 'error';
        notify(n.title, n.message, t);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient, prefs]);

  // Periodic business alerts
  useEffect(() => {
    if (!user) return;

    async function checkBusinessAlerts() {
      const now = new Date();

      if (prefs.stagnant_deal) {
        const { data: stagnantDeals } = await supabase
          .from('deals')
          .select('id, name, days_in_stage, stage')
          .gt('days_in_stage', 14)
          .not('stage', 'in', '("closed_won","closed_lost","canceled","lost")')
          .order('days_in_stage', { ascending: false })
          .limit(3);
        if (stagnantDeals && stagnantDeals.length > 0) {
          notify('⚠️ Deal Stagnan', `${stagnantDeals.length} deal sudah lebih dari 14 hari tanpa pergerakan`);
        }
      }

      if (prefs.overdue_invoice) {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { count: overdueCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .is('paid_date', null)
          .lt('due_date', thirtyDaysAgo.toISOString().split('T')[0]);
        if (overdueCount && overdueCount > 0) {
          notify('⚠️ Invoice Jatuh Tempo', `${overdueCount} invoice jatuh tempo lebih dari 30 hari`);
        }
      }

      if (prefs.low_activity) {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: activityCount } = await supabase
          .from('sales_activities')
          .select('id', { count: 'exact', head: true })
          .eq('sales_id', user!.id)
          .gte('activity_date', weekAgo.toISOString().split('T')[0]);
        if (activityCount !== null && activityCount < 5) {
          notify('📉 Aktivitas Rendah', `Hanya ${activityCount} aktivitas minggu ini. Target: 5/minggu`);
        }
      }
    }

    const initialTimeout = setTimeout(checkBusinessAlerts, 10000);
    const interval = setInterval(checkBusinessAlerts, 5 * 60 * 1000);
    return () => { clearTimeout(initialTimeout); clearInterval(interval); };
  }, [user, prefs]);

  return null;
}
