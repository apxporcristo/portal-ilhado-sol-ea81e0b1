import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthClient } from '@/lib/supabase-external';
import type { User, Session, SupabaseClient } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    let subscription: any = null;

    const init = async () => {
      const client = await getAuthClient();
      clientRef.current = client;

      const { data: { subscription: sub } } = client.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );
      subscription = sub;

      const { data: { session: existingSession } } = await client.auth.getSession();
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    };

    init();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = clientRef.current || await getAuthClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = clientRef.current || await getAuthClient();
    const { error } = await client.auth.signUp({ 
      email, 
      password,
      options: { emailRedirectTo: window.location.origin }
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const client = clientRef.current || await getAuthClient();
    await client.auth.signOut();
  }, []);

  return { user, session, loading, signIn, signUp, signOut };
}
