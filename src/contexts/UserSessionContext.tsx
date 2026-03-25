import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSupabaseClient } from '@/lib/supabase-external';
import { hashPassword, verifyPassword } from '@/lib/password-utils';

export interface UserAccess {
  user_id: string;
  nome: string;
  email: string;
  cpf: string;
  ativo: boolean;
  acesso_voucher: boolean;
  acesso_cadastrar_produto: boolean;
  acesso_ficha_consumo: boolean;
  acesso_comanda: boolean;
  is_admin: boolean;
  voucher_tempo_acesso: string | null;
}

interface UserSessionContextType {
  user: { id: string; email: string } | null;
  session: { user_id: string } | null;
  access: UserAccess | null;
  loading: boolean;
  signIn: (cpf: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const SESSION_KEY = 'app-session';
const UserSessionContext = createContext<UserSessionContextType | null>(null);

export function useUserSession() {
  const ctx = useContext(UserSessionContext);
  if (!ctx) throw new Error('useUserSession must be used within UserSessionProvider');
  return ctx;
}

export function useOptionalUserSession() {
  return useContext(UserSessionContext);
}

function loadStoredSession(): { user_id: string; email: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.user_id) return parsed;
  } catch { /* ignore */ }
  return null;
}

function saveSession(data: { user_id: string; email: string }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [session, setSession] = useState<{ user_id: string } | null>(null);
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccess = useCallback(async (userId: string) => {
    try {
      const db = await getSupabaseClient();
      const [profileRes, permRes] = await Promise.all([
        db.from('user_profiles').select('nome, email, cpf, ativo').eq('id', userId).maybeSingle(),
        db.from('user_permissions').select('acesso_voucher, acesso_cadastrar_produto, acesso_ficha_consumo, acesso_comanda, is_admin, voucher_tempo_acesso').eq('user_id', userId).maybeSingle(),
      ]);

      const profile = profileRes.data as any;
      const perm = permRes.data as any;

      if (profile || perm) {
        setAccess({
          user_id: userId,
          nome: profile?.nome || '',
          email: profile?.email || '',
          cpf: profile?.cpf || '',
          ativo: profile?.ativo ?? true,
          acesso_voucher: perm?.acesso_voucher ?? false,
          acesso_cadastrar_produto: perm?.acesso_cadastrar_produto ?? false,
          acesso_ficha_consumo: perm?.acesso_ficha_consumo ?? false,
          acesso_comanda: perm?.acesso_comanda ?? false,
          is_admin: perm?.is_admin ?? false,
          voucher_tempo_acesso: perm?.voucher_tempo_acesso ?? null,
        });
      }
    } catch (err) {
      console.error('Error loading user access:', err);
    }
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = loadStoredSession();
    if (stored) {
      setUser({ id: stored.user_id, email: stored.email });
      setSession({ user_id: stored.user_id });
      loadAccess(stored.user_id).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadAccess]);

  const signIn = useCallback(async (cpf: string, password: string) => {
    try {
      const db = await getSupabaseClient();

      // Lookup user by CPF
      const { data: profile, error: lookupErr } = await db
        .from('user_profiles')
        .select('id, email, ativo, senha_hash, cpf')
        .eq('cpf', cpf)
        .maybeSingle();

      if (lookupErr || !profile) {
        return { error: { message: 'CPF não encontrado no sistema.' } };
      }

      const p = profile as any;
      if (p.ativo === false) {
        return { error: { message: 'Usuário inativo. Contate o administrador.' } };
      }

      if (!p.senha_hash) {
        return { error: { message: 'Senha não configurada. Contate o administrador.' } };
      }

      // Verify password
      const valid = await verifyPassword(password, cpf, p.senha_hash);
      if (!valid) {
        return { error: { message: 'CPF ou senha incorretos.' } };
      }

      // Set session
      const sessionData = { user_id: p.id, email: p.email };
      saveSession(sessionData);
      setUser({ id: p.id, email: p.email });
      setSession({ user_id: p.id });
      await loadAccess(p.id);

      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message || 'Erro ao fazer login.' } };
    }
  }, [loadAccess]);

  const signOut = useCallback(async () => {
    clearSession();
    setAccess(null);
    setUser(null);
    setSession(null);
  }, []);

  const refreshAccess = useCallback(async () => {
    if (user) {
      await loadAccess(user.id);
    }
  }, [user, loadAccess]);

  return (
    <UserSessionContext.Provider value={{ user, session, access, loading, signIn, signOut, refreshAccess }}>
      {children}
    </UserSessionContext.Provider>
  );
}
