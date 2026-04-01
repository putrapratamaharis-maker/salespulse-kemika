import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

// Request browser notification permission
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showBrowserNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `notif-${Date.now()}`,
    });
  } catch {
    // Silent fail for environments that don't support Notification constructor
  }
}

export function NotificationListener() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permissionRequested = useRef(false);

  // Request permission on mount
  useEffect(() => {
    if (!permissionRequested.current && user) {
      permissionRequested.current = true;
      requestNotificationPermission();
    }
  }, [user]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as {
            title: string;
            message: string;
            type: string;
          };

          // In-app toast
          const isSuccess = notif.type === 'deletion_approved';
          if (isSuccess) {
            toast.success(notif.title, { description: notif.message, duration: 6000 });
          } else {
            toast.error(notif.title, { description: notif.message, duration: 6000 });
          }

          // Browser notification
          showBrowserNotification(notif.title, notif.message);

          // Invalidate any notification-related queries
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Periodic business alerts check (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    async function checkBusinessAlerts() {
      const now = new Date();

      // Check stagnant deals (>14 days)
      const { data: stagnantDeals } = await supabase
        .from('deals')
        .select('id, name, days_in_stage, stage')
        .gt('days_in_stage', 14)
        .not('stage', 'in', '("closed_won","closed_lost","canceled","lost")')
        .order('days_in_stage', { ascending: false })
        .limit(3);

      if (stagnantDeals && stagnantDeals.length > 0) {
        const msg = `${stagnantDeals.length} deal sudah lebih dari 14 hari tanpa pergerakan`;
        toast.warning('⚠️ Deal Stagnan', { description: msg, duration: 8000 });
        showBrowserNotification('Deal Stagnan', msg);
      }

      // Check overdue invoices (>30 days)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .is('paid_date', null)
        .lt('due_date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (overdueCount && overdueCount > 0) {
        const msg = `${overdueCount} invoice jatuh tempo lebih dari 30 hari`;
        toast.warning('⚠️ Invoice Jatuh Tempo', { description: msg, duration: 8000 });
        showBrowserNotification('Invoice Jatuh Tempo', msg);
      }

      // Check low weekly activity
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: activityCount } = await supabase
        .from('sales_activities')
        .select('id', { count: 'exact', head: true })
        .eq('sales_id', user!.id)
        .gte('activity_date', weekAgo.toISOString().split('T')[0]);

      if (activityCount !== null && activityCount < 5) {
        const msg = `Hanya ${activityCount} aktivitas minggu ini. Target: 5/minggu`;
        toast.warning('📉 Aktivitas Rendah', { description: msg, duration: 8000 });
        showBrowserNotification('Aktivitas Rendah', msg);
      }
    }

    // Initial check after 10 seconds (give time for page to load)
    const initialTimeout = setTimeout(checkBusinessAlerts, 10000);
    // Then every 5 minutes
    const interval = setInterval(checkBusinessAlerts, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [user]);

  return null; // This is a headless component
}
