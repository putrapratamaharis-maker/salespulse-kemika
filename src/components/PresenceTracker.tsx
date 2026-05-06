import { useEffect, useRef } from 'react';
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
  const lastActiveRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    let onlineAt = new Date().toISOString();
    let profileData: { full_name: string; avatar_url: string | null } = {
      full_name: 'User',
      avatar_url: null,
    };

    const trackPresence = async () => {
      await channel.track({
        full_name: profileData.full_name,
        avatar_url: profileData.avatar_url,
        online_at: onlineAt,
        last_active_at: new Date(lastActiveRef.current).toISOString(),
      });
    };

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
      profileData = {
        full_name: profile?.full_name || 'User',
        avatar_url: signedAvatar,
      };
      await trackPresence();
    });

    // Track user activity to determine Active vs Idle
    const bumpActivity = () => {
      lastActiveRef.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, bumpActivity, { passive: true }));

    // Re-broadcast periodically so other clients can recompute Active/Idle
    const interval = window.setInterval(() => {
      trackPresence();
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bumpActivity));
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}