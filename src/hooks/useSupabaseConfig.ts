import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

interface ConnectionStatus {
  status: 'idle' | 'testing' | 'connected' | 'error';
  message: string;
}

export function useSupabaseConfig() {
  const [config, setConfig] = useState<SupabaseConfig>({
    url: '',
    anonKey: '',
    isConfigured: false,
  });
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'idle',
    message: '',
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await (cloudSupabase
          .from('app_settings' as any)
          .select('setting_key, value')
          .eq('setting_key', 'default')
          .maybeSingle() as any);

        if (error) {
          console.error('Error loading config from database:', error);
          setLoading(false);
          return;
        }

        if (data?.value) {
          try {
            const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            if (parsed.supabase_url && parsed.supabase_anon_key) {
              setConfig({
                url: parsed.supabase_url,
                anonKey: parsed.supabase_anon_key,
                isConfigured: true,
              });
            }
          } catch {
            console.error('Error parsing config value');
          }
        }
      } catch (e) {
        console.error('Error loading Supabase config:', e);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const updateConfig = useCallback((url: string, anonKey: string) => {
    setConfig(prev => ({ ...prev, url, anonKey }));
  }, []);

  const testConnection = useCallback(async (url: string, anonKey: string) => {
    if (!url || !anonKey) {
      setConnectionStatus({ status: 'error', message: 'URL e Chave Anon são obrigatórios' });
      return false;
    }

    setConnectionStatus({ status: 'testing', message: 'Testando conexão...' });

    try {
      const testClient = createClient(url, anonKey);
      const { error } = await testClient.from('vouchers').select('id').limit(1);

      if (error) {
        setConnectionStatus({ status: 'error', message: `Erro: ${error.message}` });
        return false;
      }

      setConnectionStatus({ status: 'connected', message: 'Conexão bem-sucedida! Tabela vouchers encontrada.' });
      return true;
    } catch (e: any) {
      setConnectionStatus({ status: 'error', message: `Erro de conexão: ${e.message}` });
      return false;
    }
  }, []);

  const saveConfig = useCallback(async (url: string, anonKey: string) => {
    const success = await testConnection(url, anonKey);
    
    if (success) {
      try {
        const jsonValue = JSON.stringify({ supabase_url: url, supabase_anon_key: anonKey });

        const { error } = await cloudSupabase
          .from('app_settings' as any)
          .upsert(
            { setting_key: 'default', value: jsonValue } as any,
            { onConflict: 'setting_key' }
          );

        if (error) {
          setConnectionStatus({ status: 'error', message: `Erro ao salvar: ${error.message}` });
          return false;
        }

        localStorage.removeItem('voucher_supabase_config');

        setConfig({ url, anonKey, isConfigured: true });
        setConnectionStatus({
          status: 'connected',
          message: 'Configuração salva no banco de dados! Disponível em todos os dispositivos.',
        });
      } catch (e: any) {
        setConnectionStatus({ status: 'error', message: `Erro ao salvar: ${e.message}` });
        return false;
      }
    }
    
    return success;
  }, [testConnection]);

  const clearConfig = useCallback(async () => {
    try {
      await cloudSupabase
        .from('app_settings' as any)
        .delete()
        .eq('setting_key', 'default');

      localStorage.removeItem('voucher_supabase_config');
    } catch (e) {
      console.error('Error clearing config:', e);
    }

    setConfig({ url: '', anonKey: '', isConfigured: false });
    setConnectionStatus({ status: 'idle', message: '' });
  }, []);

  return { config, connectionStatus, loading, updateConfig, testConnection, saveConfig, clearConfig };
}
