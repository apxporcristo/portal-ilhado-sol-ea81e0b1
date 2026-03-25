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
    const serverUrl = getLocalPrintServerUrl();
    if (!serverUrl) {
      toast({ title: '⚠️ Print Server não configurado', description: 'Configure o IP do Print Server na aba Impressoras.', variant: 'destructive' });
      return false;
    }
    try {
      const encoded = btoa(unescape(encodeURIComponent(conteudo)));
      const res = await fetch(`${serverUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port: Number(port), data: encoded }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro no Print Server');
      toast({ title: '✅ Impresso com sucesso!' });
      return true;
    } catch (e) {
      toast({ title: '❌ Erro na impressão direta', description: (e as Error).message, variant: 'destructive' });
      return false;
    }
  }, []);

  return { jobs, loading, fetchJobs, createPrintJob, printDirect };
}
