import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { resolveAvatarUrl } from '@/lib/avatarUrl';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { id: string; full_name: string; email: string; segment: string; region: string; avatar_url: string | null } | null;
  userRole: { org_role: string; system_role: string } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [userRole, setUserRole] = useState<AuthContextType['userRole']>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Fetch profile and role in separate queries to avoid blocking
        setTimeout(() => {
          fetchProfileAndRole(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setUserRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfileAndRole(userId: string) {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).single(),
        supabase.from('user_roles').select('*').eq('user_id', userId).single(),
      ]);

      if (profileRes.data) {
        // Block inactive accounts (pending admin approval) from using the app.
        if (profileRes.data.is_active === false) {
          await supabase.auth.signOut();
          if (typeof window !== 'undefined') {
            window.alert(
              'Akun Anda belum aktif. Silakan tunggu persetujuan dari administrator sebelum dapat masuk ke aplikasi.',
            );
          }
          setProfile(null);
          setUserRole(null);
          setLoading(false);
          return;
        }

        const signedAvatar = await resolveAvatarUrl(profileRes.data.avatar_url as string | null);
        setProfile({
          id: profileRes.data.id as string,
          full_name: profileRes.data.full_name as string,
          email: profileRes.data.email as string,
          segment: profileRes.data.segment as string,
          region: profileRes.data.region as string,
          avatar_url: signedAvatar,
        });
      }

      if (roleRes.data) {
        setUserRole({
          org_role: roleRes.data.org_role as string,
          system_role: roleRes.data.system_role as string,
        });
      }
    } catch (error) {
      console.error('Error fetching profile/role:', error);
    } finally {
      setLoading(false);
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUserRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, userRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
