import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/hooks/useVouchers';
import { toast } from '@/hooks/use-toast';

export interface PrintJob {
  id: string;
  printer_id: string;
  conteudo: string;
  formato: string;
  status: 'pendente' | 'imprimindo' | 'concluido' | 'erro';
  erro: string | null;
  created_at: string;
  updated_at: string;
}

/** Retorna a URL do print server local salva em localStorage */
export function getLocalPrintServerUrl(): string {
  return localStorage.getItem('print_server_url') || '';
}

export function setLocalPrintServerUrl(url: string) {
  localStorage.setItem('print_server_url', url);
}

export function usePrintJobs() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('print_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setJobs((data as any[]) || []);
    } catch (e) {
      console.error('Erro ao buscar print_jobs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const createPrintJob = useCallback(async (printerId: string, conteudo: string, formato = 'escpos'): Promise<boolean> => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(conteudo)));
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from('print_jobs')
        .insert({ printer_id: printerId, conteudo: encoded, formato, status: 'pendente' } as any);
      if (error) throw error;
      toast({ title: '📋 Tarefa enviada para a fila', description: 'Status: PENDENTE. Aguardando o Print Server processar.' });
      await fetchJobs();
      return true;
    } catch (e) {
      toast({ title: '❌ Erro ao criar tarefa', description: (e as Error).message, variant: 'destructive' });
      return false;
    }
  }, [fetchJobs]);

  /** Impressão direta via Print Server HTTP local (sem fila) */
  const printDirect = useCallback(async (ip: string, port: number | string, conteudo: string): Promise<boolean> => {
    if (window.IS_ANDROID_APP === true && window.AndroidBridge?.smartPrint) {
      try {
        window.AndroidBridge.smartPrint(conteudo);
        toast({ title: '✅ Enviado para o app Android', description: 'A impressão foi enviada pelo AndroidBridge.' });
        return true;
      } catch (e) {
        toast({ title: '❌ Erro na impressão direta', description: (e as Error).message, variant: 'destructive' });
        return false;
      }
    }

    // Tentar enviar via Print Server local salvo
    const serverUrl = getLocalPrintServerUrl().trim().replace(/\/+$/, '');
    if (!serverUrl) {
      toast({ title: 'Impressão indisponível', description: 'Configure o Print Server Local nas configurações de impressora.', variant: 'destructive' });
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${serverUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port: Number(port), data: conteudo }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      toast({ title: '✅ Enviado para impressora', description: `Dados enviados via Print Server.` });
      return true;
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Print Server não respondeu (timeout).' : 'Não foi possível conectar ao Print Server. Verifique se está rodando.';
      toast({ title: 'Erro na impressão', description: msg, variant: 'destructive' });
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  return { jobs, loading, fetchJobs, createPrintJob, printDirect };
}
