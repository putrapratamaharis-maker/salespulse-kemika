import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

/**
 * Global presence tracker. Mounted once at the app layout level so that any
 * authenticated user is broadcast as "online" regardless of which page they
 * are currently viewing. Subscribers (e.g. LiveStatusRow) read from the same
 * `online-users` channel to display the list.
 */
export function PresenceTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user.id)
        .single();
      let signedAvatar: string | null = null;
      if (profile?.avatar_url) {
        const { resolveAvatarUrl } = await import('@/lib/avatarUrl');
        signedAvatar = await resolveAvatarUrl(profile.avatar_url);
      }
      await channel.track({
        full_name: profile?.full_name || 'User',
        avatar_url: signedAvatar,
        online_at: new Date().toISOString(),
      });
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}