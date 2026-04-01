import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationPreferences {
  stagnant_deal: boolean;
  overdue_invoice: boolean;
  low_margin: boolean;
  low_activity: boolean;
  deletion_alerts: boolean;
  browser_push: boolean;
  sound_enabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  stagnant_deal: true,
  overdue_invoice: true,
  low_margin: true,
  low_activity: true,
  deletion_alerts: true,
  browser_push: true,
  sound_enabled: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchPrefs();
  }, [user]);

  async function fetchPrefs() {
    if (!user) return;
    const { data } = await supabase
      .from('notification_preferences' as any)
      .select('*')
      .eq('user_id', user.id)
      .single();

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
    setLoading(false);
  }

  async function updatePref(key: keyof NotificationPreferences, value: boolean) {
    if (!user) return;
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    // Upsert
    const { data: existing } = await supabase
      .from('notification_preferences' as any)
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      await supabase
        .from('notification_preferences' as any)
        .update({ [key]: value } as any)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('notification_preferences' as any)
        .insert({ user_id: user.id, ...newPrefs } as any);
    }
  }

  return { prefs, loading, updatePref };
}
