import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '@/hooks/useVouchers';
import { toast } from '@/hooks/use-toast';

export interface FormaPagamento {
  id: string;
  nome: string;
  ativo: boolean;
  exibir_troco: boolean;
  created_at: string;
  updated_at: string;
}

export function useFormasPagamento() {
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFormas = useCallback(async () => {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('formas_pagamento' as any)
      .select('*')
      .order('nome');
    if (!error && data) {
      setFormas(data as unknown as FormaPagamento[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFormas(); }, [fetchFormas]);

  const createForma = useCallback(async (forma: { nome: string; ativo?: boolean; exibir_troco?: boolean }) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('formas_pagamento' as any).insert(forma as any);
    if (error) {
      toast({ title: 'Erro', description: `Não foi possível criar: ${error.message}`, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Forma de pagamento criada' });
    await fetchFormas();
    return true;
  }, [fetchFormas]);

  const updateForma = useCallback(async (id: string, data: Partial<FormaPagamento>) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('formas_pagamento' as any).update(data as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: `Não foi possível atualizar: ${error.message}`, variant: 'destructive' });
      return false;
    }
    await fetchFormas();
    return true;
  }, [fetchFormas]);

  const deleteForma = useCallback(async (id: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('formas_pagamento' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: `Não foi possível excluir: ${error.message}`, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Forma de pagamento excluída' });
    await fetchFormas();
    return true;
  }, [fetchFormas]);

  const formasAtivas = formas.filter(f => f.ativo);

  return { formas, formasAtivas, loading, createForma, updateForma, deleteForma, refetch: fetchFormas };
}
