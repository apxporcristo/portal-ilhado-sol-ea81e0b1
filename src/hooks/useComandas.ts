import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient, getAuthClient } from '@/lib/supabase-external';
import { toast } from '@/hooks/use-toast';

export interface Comanda {
  id: string;
  numero: number;
  status: 'livre' | 'aberta' | 'fechada';
  nome_cliente: string | null;
  telefone_cliente: string | null;
  observacao: string | null;
  ativo: boolean;
  aberta_em: string | null;
  fechada_em: string | null;
  fechada_por: string | null;
  forma_pagamento_id: string | null;
  forma_pagamento_nome: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComandaItem {
  id: string;
  comanda_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  peso: number | null;
  complementos: any[] | null;
  observacao: string | null;
  printer_id: string | null;
  impresso: boolean;
  created_at: string;
}

export interface ComandaAlteracao {
  id: string;
  comanda_id: string;
  item_id: string | null;
  tipo: 'edicao' | 'exclusao';
  descricao: string;
  usuario_email: string;
  usuario_nome: string | null;
  created_at: string;
}

export function useComandas() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComandas = useCallback(async () => {
    try {
      const supabase = await getSupabaseClient();
      const { data } = await supabase.from('comandas' as any).select('*').eq('ativo', true).order('numero');
      if (data) setComandas(data as unknown as Comanda[]);
    } catch { /* table may not exist */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchComandas(); }, [fetchComandas]);

  const comandasAbertas = comandas.filter(c => c.status === 'aberta');
  const comandasLivres = comandas.filter(c => c.status === 'livre');

  const createComanda = useCallback(async (numero: number, observacao?: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('comandas' as any).insert({ numero, observacao: observacao || null } as any);
    if (error) throw error;
    await fetchComandas();
  }, [fetchComandas]);

  const updateComanda = useCallback(async (id: string, data: Partial<Comanda>) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('comandas' as any).update({ ...data, updated_at: new Date().toISOString() } as any).eq('id', id);
    if (error) throw error;
    await fetchComandas();
  }, [fetchComandas]);

  const deleteComanda = useCallback(async (id: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('comandas' as any).delete().eq('id', id);
    if (error) throw error;
    await fetchComandas();
  }, [fetchComandas]);

  const abrirComanda = useCallback(async (id: string, nomeCliente: string, telefoneCliente?: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('comandas' as any).update({
      status: 'aberta',
      nome_cliente: nomeCliente,
      telefone_cliente: telefoneCliente || null,
      aberta_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq('id', id);
    if (error) throw error;
    await fetchComandas();
  }, [fetchComandas]);

  const fecharComanda = useCallback(async (
    id: string,
    formaPagamentoId: string,
    formaPagamentoNome: string,
    usuarioEmail: string,
    usuarioNome?: string
  ) => {
    const supabase = await getSupabaseClient();
    // 1. Mark as fechada
    const { error } = await supabase.from('comandas' as any).update({
      status: 'fechada',
      fechada_em: new Date().toISOString(),
      fechada_por: usuarioNome || usuarioEmail,
      forma_pagamento_id: formaPagamentoId,
      forma_pagamento_nome: formaPagamentoNome,
      updated_at: new Date().toISOString(),
    } as any).eq('id', id);
    if (error) throw error;

    // 2. Log the closing
    await supabase.from('comanda_alteracoes' as any).insert({
      comanda_id: id,
      tipo: 'edicao',
      descricao: `Comanda fechada - Forma: ${formaPagamentoNome} - Fechada por: ${usuarioNome || usuarioEmail}`,
      usuario_email: usuarioEmail,
      usuario_nome: usuarioNome || null,
    } as any);

    // 3. Reset comanda to 'livre' for reuse (clear client data but keep history in comanda_alteracoes)
    const { error: resetError } = await supabase.from('comandas' as any).update({
      status: 'livre',
      nome_cliente: null,
      telefone_cliente: null,
      observacao: null,
      aberta_em: null,
      fechada_em: null,
      fechada_por: null,
      forma_pagamento_id: null,
      forma_pagamento_nome: null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', id);
    if (resetError) throw resetError;

    await fetchComandas();
  }, [fetchComandas]);

  const getItensComanda = useCallback(async (comandaId: string): Promise<ComandaItem[]> => {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.from('comanda_itens' as any).select('*').eq('comanda_id', comandaId).order('created_at');
    return ((data as any[]) || []).map((d: any) => ({
      ...d,
      complementos: d.complementos_json ? (typeof d.complementos_json === 'string' ? JSON.parse(d.complementos_json) : d.complementos_json) : null,
    })) as ComandaItem[];
  }, []);

  const lancarItens = useCallback(async (comandaId: string, items: {
    produto_id: string;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    peso?: number | null;
    complementos?: any[] | null;
    observacao?: string | null;
    printer_id?: string | null;
  }[]) => {
    const supabase = await getSupabaseClient();
    const rows = items.map(item => ({
      comanda_id: comandaId,
      produto_id: item.produto_id,
      produto_nome: item.produto_nome,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      peso: item.peso || null,
      complementos_json: item.complementos ? JSON.stringify(item.complementos) : null,
      observacao: item.observacao || null,
      printer_id: item.printer_id || null,
    }));
    const { error } = await supabase.from('comanda_itens' as any).insert(rows as any);
    if (error) throw error;
  }, []);

  const editarItem = useCallback(async (itemId: string, dados: Partial<ComandaItem>) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('comanda_itens' as any).update(dados as any).eq('id', itemId);
    if (error) throw error;
  }, []);

  const excluirItem = useCallback(async (itemId: string) => {
    const supabase = await getSupabaseClient();
    const { error } = await supabase.from('comanda_itens' as any).delete().eq('id', itemId);
    if (error) throw error;
  }, []);

  const registrarAlteracao = useCallback(async (
    comandaId: string,
    itemId: string | null,
    tipo: 'edicao' | 'exclusao',
    descricao: string,
    usuarioEmail: string,
    usuarioNome?: string
  ) => {
    const supabase = await getSupabaseClient();
    await supabase.from('comanda_alteracoes' as any).insert({
      comanda_id: comandaId,
      item_id: itemId,
      tipo,
      descricao,
      usuario_email: usuarioEmail,
      usuario_nome: usuarioNome || null,
    } as any);
  }, []);

  const autenticarUsuario = useCallback(async (cpf: string, senha: string): Promise<{ success: boolean; nome?: string; email?: string }> => {
    try {
      // Lookup email by CPF
      const supabase = await getSupabaseClient();
      const { data: profile } = await supabase.from('user_profiles' as any).select('email, nome').eq('cpf', cpf).maybeSingle();
      if (!profile || !(profile as any).email) return { success: false };

      const email = (profile as any).email;
      const auth = await getAuthClient();
      const { data, error } = await auth.auth.signInWithPassword({ email, password: senha });
      if (error || !data.user) return { success: false };

      return { success: true, nome: (profile as any)?.nome || email, email };
    } catch {
      return { success: false };
    }
  }, []);

  const getAlteracoes = useCallback(async (comandaId: string): Promise<ComandaAlteracao[]> => {
    const supabase = await getSupabaseClient();
    const { data } = await supabase.from('comanda_alteracoes' as any).select('*').eq('comanda_id', comandaId).order('created_at', { ascending: false });
    return (data as unknown as ComandaAlteracao[]) || [];
  }, []);

  return {
    comandas,
    comandasAbertas,
    comandasLivres,
    loading,
    createComanda,
    updateComanda,
    deleteComanda,
    abrirComanda,
    fecharComanda,
    getItensComanda,
    lancarItens,
    editarItem,
    excluirItem,
    registrarAlteracao,
    autenticarUsuario,
    getAlteracoes,
    refetch: fetchComandas,
  };
}
