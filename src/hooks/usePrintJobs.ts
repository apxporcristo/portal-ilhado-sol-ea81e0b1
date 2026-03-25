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
  tipo_documento?: string;
  referencia_id?: string;
  printer_name?: string;
  device_ip?: string;
  device_mac?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePrintJobParams {
  printer_id: string;
  printer_name?: string;
  device_ip?: string;
  device_mac?: string;
  conteudo: string;
  formato?: string;
  tipo_documento?: string;
  referencia_id?: string;
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

  const createPrintJob = useCallback(async (
    printerIdOrParams: string | CreatePrintJobParams,
    conteudo?: string,
    formato = 'escpos'
  ): Promise<boolean> => {
    try {
      const supabase = await getSupabaseClient();
      let insertData: any;

      if (typeof printerIdOrParams === 'string') {
        const encoded = btoa(unescape(encodeURIComponent(conteudo || '')));
        insertData = {
          printer_id: printerIdOrParams,
          conteudo: encoded,
          formato,
          status: 'pendente',
        };
      } else {
        const params = printerIdOrParams;
        const encoded = btoa(unescape(encodeURIComponent(params.conteudo)));
        insertData = {
          printer_id: params.printer_id,
          conteudo: encoded,
          formato: params.formato || 'escpos',
          status: 'pendente',
          ...(params.printer_name && { printer_name: params.printer_name }),
          ...(params.device_ip && { device_ip: params.device_ip }),
          ...(params.device_mac && { device_mac: params.device_mac }),
          ...(params.tipo_documento && { tipo_documento: params.tipo_documento }),
          ...(params.referencia_id && { referencia_id: params.referencia_id }),
        };
      }

      const { error } = await supabase
        .from('print_jobs')
        .insert(insertData as any);
      if (error) throw error;
      toast({ title: '📋 Tarefa enviada para a fila', description: 'Status: PENDENTE. Aguardando processamento.' });
      await fetchJobs();
      return true;
    } catch (e) {
      toast({ title: '❌ Erro ao criar tarefa', description: (e as Error).message, variant: 'destructive' });
      return false;
    }
  }, [fetchJobs]);

  return { jobs, loading, fetchJobs, createPrintJob };
}
