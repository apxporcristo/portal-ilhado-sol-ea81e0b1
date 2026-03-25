import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/hooks/useVouchers';
import { toast } from '@/hooks/use-toast';

export interface Impressora {
  id: string;
  nome: string;
  tipo: 'rede' | 'bluetooth';
  ip: string | null;
  porta: string | null;
  bluetooth_nome: string | null;
  bluetooth_mac: string | null;
  descricao: string | null;
  ativa: boolean;
  padrao: boolean;
  created_at: string;
  updated_at: string;
}

export type VoucherPrintTarget = 'default_printer' | 'bluetooth_printer';

export interface VoucherPrintConfig {
  voucher_print_target: VoucherPrintTarget;
  voucher_bluetooth_printer_id: string | null;
}

export function useImpressoras() {
  const [impressoras, setImpressoras] = useState<Impressora[]>([]);
  const [loading, setLoading] = useState(true);
  const [voucherConfig, setVoucherConfig] = useState<VoucherPrintConfig>({
    voucher_print_target: 'default_printer',
    voucher_bluetooth_printer_id: null,
  });

  const fetchImpressoras = useCallback(async () => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('printers' as any)
      .select('*')
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Erro ao carregar impressoras:', error);
    } else {
      setImpressoras((data as unknown as Impressora[]) || []);
    }
    setLoading(false);
  }, []);

  const fetchVoucherConfig = useCallback(async () => {
    const supabase = await getSupabaseClient();
    const { data } = await supabase
      .from('app_settings' as any)
      .select('setting_key, value')
      .in('setting_key', ['voucher_print_target', 'voucher_bluetooth_printer_id']);
    if (data) {
      const config: VoucherPrintConfig = {
        voucher_print_target: 'default_printer',
        voucher_bluetooth_printer_id: null,
      };
      (data as any[]).forEach((row) => {
        if (row.setting_key === 'voucher_print_target') {
          config.voucher_print_target = row.value as VoucherPrintTarget;
        }
        if (row.setting_key === 'voucher_bluetooth_printer_id') {
          config.voucher_bluetooth_printer_id = row.value || null;
        }
      });
      setVoucherConfig(config);
    }
  }, []);

  useEffect(() => {
    fetchImpressoras();
    fetchVoucherConfig();
  }, [fetchImpressoras, fetchVoucherConfig]);

  const createImpressora = useCallback(async (data: Omit<Impressora, 'id' | 'created_at' | 'updated_at'>) => {
    const supabase = await getSupabaseClient();
    if (data.padrao) {
      await supabase.from('printers' as any).update({ padrao: false } as any).eq('padrao', true);
    }
    const { error } = await supabase.from('printers' as any).insert(data as any);
    if (error) {
      toast({ title: 'Erro', description: `Não foi possível criar a impressora: ${error.message}`, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Impressora criada', description: `${data.nome} foi adicionada.` });
    await fetchImpressoras();
    return true;
  }, [fetchImpressoras]);

  const updateImpressora = useCallback(async (id: string, data: Partial<Impressora>) => {
    const supabase = await getSupabaseClient();
    if (data.padrao) {
      await supabase.from('printers' as any).update({ padrao: false } as any).eq('padrao', true);
    }
    const { error } = await supabase.from('printers' as any).update(data as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: `Não foi possível atualizar a impressora: ${error.message}`, variant: 'destructive' });
      return false;
    }
    await fetchImpressoras();
    return true;
  }, [fetchImpressoras]);

  const deleteImpressora = useCallback(async (id: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('printers' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: `Não foi possível excluir a impressora: ${error.message}`, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Impressora excluída' });
    await fetchImpressoras();
    return true;
  }, [fetchImpressoras]);

  const setAsDefault = useCallback(async (id: string) => {
    const supabase = await getSupabaseClient();
    await supabase.from('printers' as any).update({ padrao: false } as any).eq('padrao', true);
    await supabase.from('printers' as any).update({ padrao: true } as any).eq('id', id);
    await fetchImpressoras();
    toast({ title: 'Impressora padrão definida' });
  }, [fetchImpressoras]);

  const toggleAtiva = useCallback(async (id: string, ativa: boolean) => {
    const supabase = await getSupabaseClient();
    await supabase.from('printers' as any).update({ ativa } as any).eq('id', id);
    await fetchImpressoras();
  }, [fetchImpressoras]);

  const getDefaultPrinter = useCallback((): Impressora | undefined => {
    return impressoras.find(p => p.padrao && p.ativa);
  }, [impressoras]);

  const getBluetoothPrinters = useCallback((): Impressora[] => {
    return impressoras.filter(p => p.tipo === 'bluetooth' && p.ativa);
  }, [impressoras]);

  const saveVoucherConfig = useCallback(async (config: VoucherPrintConfig) => {
    const supabase = await getSupabaseClient();
    const keys = [
      { setting_key: 'voucher_print_target', key: 'voucher_print_target', value: config.voucher_print_target },
      { setting_key: 'voucher_bluetooth_printer_id', key: 'voucher_bluetooth_printer_id', value: config.voucher_bluetooth_printer_id || '' },
    ];
    for (const item of keys) {
      const { error } = await supabase
        .from('app_settings' as any)
        .upsert(item as any, { onConflict: 'setting_key' } as any);
      if (error) {
        console.error('Erro ao salvar config voucher:', error);
      }
    }
    setVoucherConfig(config);
    toast({ title: 'Configuração salva', description: 'Destino de impressão de voucher atualizado.' });
  }, []);

  const getVoucherPrinter = useCallback((): { printer: Impressora | null; error: string | null } => {
    if (voucherConfig.voucher_print_target === 'bluetooth_printer') {
      if (!voucherConfig.voucher_bluetooth_printer_id) {
        return { printer: null, error: 'Nenhuma impressora Bluetooth selecionada para vouchers.' };
      }
      const bt = impressoras.find(p => p.id === voucherConfig.voucher_bluetooth_printer_id);
      if (!bt) return { printer: null, error: 'Impressora Bluetooth configurada para voucher não encontrada.' };
      if (!bt.ativa) return { printer: null, error: 'Impressora Bluetooth configurada para voucher está inativa.' };
      return { printer: bt, error: null };
    }
    const def = getDefaultPrinter();
    if (!def) return { printer: null, error: 'Nenhuma impressora padrão configurada.' };
    return { printer: def, error: null };
  }, [voucherConfig, impressoras, getDefaultPrinter]);

  return {
    impressoras,
    loading,
    voucherConfig,
    createImpressora,
    updateImpressora,
    deleteImpressora,
    setAsDefault,
    toggleAtiva,
    getDefaultPrinter,
    getBluetoothPrinters,
    saveVoucherConfig,
    getVoucherPrinter,
    refetch: fetchImpressoras,
  };
}
