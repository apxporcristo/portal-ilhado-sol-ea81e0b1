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
  target_device_code?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePrintJobParams {
  printer_id: string;
  printer_name?: string;
  device_ip?: string;
  device_mac?: string;
  target_device_code?: string;
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

  const resolveDeviceCode = useCallback(async (printerId: string, explicitCode?: string): Promise<string | null> => {
    if (explicitCode) return explicitCode;
    try {
      const supabase = await getSupabaseClient();
      const { data } = await supabase
        .from('devices' as any)
        .select('device_code')
        .eq('printer_id', printerId)
        .eq('ativo', true)
        .limit(1);
      const code = (data as any[])?.[0]?.device_code || null;
      console.log('[PrintJob] device_code resolvido:', code, 'para printer_id:', printerId);
      return code;
    } catch (e) {
      console.warn('[PrintJob] Falha ao resolver device_code:', e);
      return null;
    }
  }, []);

  const createPrintJob = useCallback(async (params: CreatePrintJobParams): Promise<boolean> => {
    try {
      const supabase = await getSupabaseClient();
      const encoded = btoa(unescape(encodeURIComponent(params.conteudo)));
      const deviceCode = await resolveDeviceCode(params.printer_id, params.target_device_code);
      const insertData: Record<string, any> = {
        printer_id: params.printer_id,
        conteudo: encoded,
        formato: params.formato || 'escpos',
        status: 'pendente',
      };
      if (params.printer_name) insertData.printer_name = params.printer_name;
      if (params.device_ip) insertData.device_ip = params.device_ip;
      if (params.device_mac) insertData.device_mac = params.device_mac;
      if (deviceCode) insertData.target_device_code = deviceCode;
      if (params.tipo_documento) insertData.tipo_documento = params.tipo_documento;
      if (params.referencia_id) insertData.referencia_id = params.referencia_id;

      console.log('[PrintJob] Criando job:', {
        printer_id: params.printer_id,
        printer_name: params.printer_name,
        target_device_code: deviceCode,
        tipo_documento: params.tipo_documento,
        referencia_id: params.referencia_id,
        formato: params.formato || 'escpos',
        conteudo_length: params.conteudo.length,
      });

      const { data, error } = await supabase
        .from('print_jobs')
        .insert(insertData as any)
        .select();

      console.log('[PrintJob] Resposta insert:', data, 'erro:', error);

      if (error) throw error;
      toast({ title: '📋 Enviado para fila de impressão', description: `Impressora: ${params.printer_name || params.printer_id}` });
      await fetchJobs();
      return true;
    } catch (e) {
      console.error('[PrintJob] Erro ao criar job:', e);
      toast({ title: '❌ Erro ao criar tarefa de impressão', description: (e as Error).message, variant: 'destructive' });
      return false;
    }
  }, [fetchJobs, resolveDeviceCode]);

  /**
   * Helper: create a print job from raw ESC/POS binary data (Uint8Array).
   * Encodes the binary as base64 directly.
   */
  const createPrintJobFromBinary = useCallback(async (
    params: Omit<CreatePrintJobParams, 'conteudo'> & { data: Uint8Array }
  ): Promise<boolean> => {
    try {
      const supabase = await getSupabaseClient();
      let binary = '';
      const bytes = params.data;
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const encoded = btoa(binary);
      const deviceCode = await resolveDeviceCode(params.printer_id, params.target_device_code);

      const insertData: Record<string, any> = {
        printer_id: params.printer_id,
        conteudo: encoded,
        formato: params.formato || 'escpos',
        status: 'pendente',
      };
      if (params.printer_name) insertData.printer_name = params.printer_name;
      if (params.device_ip) insertData.device_ip = params.device_ip;
      if (params.device_mac) insertData.device_mac = params.device_mac;
      if (deviceCode) insertData.target_device_code = deviceCode;
      if (params.tipo_documento) insertData.tipo_documento = params.tipo_documento;
      if (params.referencia_id) insertData.referencia_id = params.referencia_id;

      console.log('[PrintJob] Criando job binário:', {
        printer_id: params.printer_id,
        printer_name: params.printer_name,
        target_device_code: deviceCode,
        tipo_documento: params.tipo_documento,
        bytes: bytes.length,
      });

      const { data: result, error } = await supabase
        .from('print_jobs')
        .insert(insertData as any)
        .select();

      console.log('[PrintJob] Resposta insert binário:', result, 'erro:', error);

      if (error) throw error;
      await fetchJobs();
      return true;
    } catch (e) {
      console.error('[PrintJob] Erro ao criar job binário:', e);
      toast({ title: '❌ Erro ao criar tarefa de impressão', description: (e as Error).message, variant: 'destructive' });
      return false;
    }
  }, [fetchJobs, resolveDeviceCode]);

  return { jobs, loading, fetchJobs, createPrintJob, createPrintJobFromBinary };
}
