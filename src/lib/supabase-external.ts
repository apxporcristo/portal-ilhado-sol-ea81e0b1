import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

let cachedExternalClient: SupabaseClient | null = null;
let cachedConfig: { url: string; anonKey: string } | null = null;
let configPromise: Promise<{ url: string; anonKey: string } | null> | null = null;

async function loadExternalConfig(): Promise<{ url: string; anonKey: string } | null> {
  if (cachedConfig) return cachedConfig;

  const { data, error } = await (cloudSupabase
    .from('app_settings' as any)
    .select('setting_key, value')
    .eq('setting_key', 'default')
    .maybeSingle() as any);

  if (error || !data?.value) return null;

  try {
    const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (!parsed.supabase_url || !parsed.supabase_anon_key) return null;
    cachedConfig = { url: parsed.supabase_url, anonKey: parsed.supabase_anon_key };
    return cachedConfig;
  } catch {
    return null;
  }
}

function getConfigPromise() {
  if (!configPromise) {
    configPromise = loadExternalConfig()
      .then((config) => {
        // Do not cache null forever; allow retry on next call
        if (!config) {
          configPromise = null;
        }
        return config;
      })
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
}

/**
 * Returns the external Supabase client for AUTH operations.
 * Falls back to Lovable Cloud client if external config is not set.
 */
export async function getAuthClient(): Promise<SupabaseClient> {
  const config = await getConfigPromise();
  if (!config) return cloudSupabase;

  if (!cachedExternalClient) {
    cachedExternalClient = createClient(config.url, config.anonKey, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'external-auth-token',
      },
    });
  }

  return cachedExternalClient;
}

/**
 * Returns the external Supabase client for DATA operations (same client).
 */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  return getAuthClient();
}

/**
 * Resets cached client (useful when config changes).
 */
export function resetExternalClient() {
  cachedExternalClient = null;
  cachedConfig = null;
  configPromise = null;
}
