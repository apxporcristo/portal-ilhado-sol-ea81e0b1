import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase as lovableSupabase } from '@/integrations/supabase/client';
import { normalizeTempoValidade } from '@/lib/voucher-utils';
import { toast } from '@/hooks/use-toast';
import type { SupabaseClient } from '@supabase/supabase-js';

function getBrazilISOString(): string {
  const now = new Date();
  const acreOffset = -5 * 60; // UTC-5 (América/Rio Branco - Acre)
  const localOffset = now.getTimezoneOffset();
  const diff = acreOffset - (-localOffset);
  const acreTime = new Date(now.getTime() + diff * 60 * 1000);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${acreTime.getFullYear()}-${pad(acreTime.getMonth() + 1)}-${pad(acreTime.getDate())}T${pad(acreTime.getHours())}:${pad(acreTime.getMinutes())}:${pad(acreTime.getSeconds())}-05:00`;
}

export async function getSupabaseClient(): Promise<SupabaseClient> {
  try {
    const { data } = await (lovableSupabase
      .from('app_settings' as any)
      .select('setting_key, value')
      .eq('setting_key', 'default')
      .maybeSingle() as any);

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (parsed.supabase_url && parsed.supabase_anon_key) {
        return createClient(parsed.supabase_url, parsed.supabase_anon_key);
      }
    }
  } catch (e) {
    console.error('Error loading external Supabase config:', e);
  }

  return lovableSupabase;
}

export interface Voucher {
  id: string;
  voucher_id: string;
  tempo_validade: string;
  status: string;
  data_uso: string | null;
  created_at: string;
}

export interface VoucherStats {
  livresPorTempo: Record<string, number>;
  usadosPorTempo: Record<string, number>;
  reservadosPorTempo: Record<string, number>;
  aExpirarPorTempo: Record<string, number>;
  totalLivres: number;
  totalUsados: number;
  totalReservados: number;
  totalAExpirar: number;
  temposDisponiveis: string[];
}

export function useVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<VoucherStats>({
    livresPorTempo: {},
    usadosPorTempo: {},
    reservadosPorTempo: {},
    aExpirarPorTempo: {},
    totalLivres: 0,
    totalUsados: 0,
    totalReservados: 0,
    totalAExpirar: 0,
    temposDisponiveis: [],
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchVouchers = useCallback(async () => {
    const supabase = await getSupabaseClient();
    try {
      // Fetch ALL vouchers using pagination (Supabase limits to 1000 per query)
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      let useCreatedAt = true;

      while (hasMore) {
        let query = supabase
          .from('vouchers')
          .select('*')
          .range(from, from + pageSize - 1);

        if (useCreatedAt) {
          query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error && error.code === '42703' && useCreatedAt) {
          console.log('created_at column not found, fetching without order');
          useCreatedAt = false;
          continue; // retry this page without ordering
        }

        if (error) throw error;

        if (data && data.length > 0) {
          allData = allData.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const data = allData;
      const error = null;

      if (error) throw error;

      // Warn if query returns empty - likely RLS issue on external DB
      if ((!data || data.length === 0)) {
        console.warn('Query returned 0 vouchers. If you have vouchers in the database, check RLS policies on the external Supabase (SELECT must be allowed for anon key).');
      }

      // Map the data to ensure consistent field names
      // Handle different possible column names from external databases
      const mappedData = (data || []).map((v: any) => {
        // Normalize status - check various possible column names and values
        let status = 'livre';
        const rawStatus = v.status || v.Status || v.STATUS || v.estado || v.Estado || '';
        const statusLower = String(rawStatus).toLowerCase().trim();
        
        // Check if status indicates "used"
        if (statusLower === 'usado' || statusLower === 'used' || statusLower === '1' || statusLower === 'true') {
          status = 'usado';
        } else if (statusLower === 'pre-reservado' || statusLower === 'pre_reservado' || statusLower === 'reservado') {
          status = 'pre-reservado';
        } else if (statusLower === 'livre' || statusLower === 'free' || statusLower === '0' || statusLower === 'false' || statusLower === '') {
          status = 'livre';
        } else if (rawStatus) {
          console.log('Unknown status value:', rawStatus, 'for voucher:', v.voucher_id);
          status = 'livre';
        }

        return {
          id: v.id,
          voucher_id: v.voucher_id || v.voucherId || v.codigo || v.code,
          tempo_validade: normalizeTempoValidade(v.tempo_validade || v.tempoValidade || v.tempo || v.time || v.validity || ''),
          status,
          data_uso: v.data_uso || v.dataUso || v.used_at || v.usedAt || null,
          created_at: v.created_at || v.createdAt || new Date().toISOString(),
        };
      });

      console.log('Fetched vouchers from external DB:', {
        total: mappedData.length,
        livres: mappedData.filter(v => v.status === 'livre').length,
        usados: mappedData.filter(v => v.status === 'usado').length,
      });

      setVouchers(mappedData);
      calculateStats(mappedData);
    } catch (error) {
      console.error('Erro ao buscar vouchers:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os vouchers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (voucherList: Voucher[]) => {
    const livresPorTempo: Record<string, number> = {};
    const usadosPorTempo: Record<string, number> = {};
    const reservadosPorTempo: Record<string, number> = {};
    const aExpirarPorTempo: Record<string, number> = {};
    const temposSet = new Set<string>();
    let totalLivres = 0;
    let totalUsados = 0;
    let totalReservados = 0;
    let totalAExpirar = 0;

    const now = new Date();
    const limiteAExpirar = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);

    voucherList.forEach((v) => {
      const tempo = v.tempo_validade;
      temposSet.add(tempo);
      if (v.status === 'livre') {
        livresPorTempo[tempo] = (livresPorTempo[tempo] || 0) + 1;
        totalLivres++;
      } else if (v.status === 'pre-reservado') {
        reservadosPorTempo[tempo] = (reservadosPorTempo[tempo] || 0) + 1;
        totalReservados++;
        if (v.data_uso && new Date(v.data_uso) <= limiteAExpirar) {
          aExpirarPorTempo[tempo] = (aExpirarPorTempo[tempo] || 0) + 1;
          totalAExpirar++;
        }
      } else {
        usadosPorTempo[tempo] = (usadosPorTempo[tempo] || 0) + 1;
        totalUsados++;
      }
    });

    const temposDisponiveis = Array.from(temposSet).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });

    setStats({ livresPorTempo, usadosPorTempo, reservadosPorTempo, aExpirarPorTempo, totalLivres, totalUsados, totalReservados, totalAExpirar, temposDisponiveis });
  };

  const importVouchers = async (
    parsedVouchers: { voucherId: string; tempoValidade: string; status?: string; dataUso?: string }[]
  ) => {
    const supabase = await getSupabaseClient();
    setProcessing(true);

    try {
      // Insert all vouchers directly into temp_vouchers without classification
      const toInsert = parsedVouchers.map(pv => ({
        voucher_id: pv.voucherId.trim(),
        tempo_validade: pv.tempoValidade,
        status: pv.status || 'livre',
        data_uso: pv.dataUso || null,
      }));

      let imported = 0;
      let errors = 0;
      let lastError: any = null;

      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { error } = await supabase.from('temp_vouchers').insert(chunk);

        if (error) {
          console.error('Erro ao inserir batch:', error);
          for (const row of chunk) {
            const { error: singleError } = await supabase.from('temp_vouchers').insert(row);
            if (singleError) {
              console.error('Erro ao inserir voucher individual:', singleError);
              lastError = singleError;
              errors++;
            } else {
              imported++;
            }
          }
        } else {
          imported += chunk.length;
        }
      }

      if (lastError && imported === 0) {
        toast({
          title: 'Erro na importação',
          description: `Erro do banco de dados: ${lastError.message || 'Verifique as permissões.'}`,
          variant: 'destructive',
        });
      } else {
        // Call RPC to process temp_vouchers into vouchers
        const { error: rpcError } = await supabase.rpc('processar_temp_vouchers_batch');

        if (rpcError) {
          console.error('Erro ao processar temp_vouchers:', rpcError);
          toast({
            title: 'Erro ao sincronizar',
            description: rpcError.message || 'Erro ao processar vouchers temporários.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Vouchers sincronizados com sucesso',
            description: `${imported} voucher(s) importados e processados.${errors > 0 ? ` ${errors} com erro na inserção.` : ''}`,
          });
        }
      }

      await fetchVouchers();
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na importação',
        description: 'Ocorreu um erro durante a importação',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const useVoucher = async (tempo: string): Promise<Voucher | null> => {
    const supabase = await getSupabaseClient();
    setProcessing(true);
    
    console.log('useVoucher called with tempo:', tempo);
    console.log('Current vouchers in state:', vouchers.length);
    console.log('Vouchers with this tempo:', vouchers.filter(v => v.tempo_validade === tempo));
    
    try {
      const localFreeVoucher = vouchers.find(
        v => v.tempo_validade === tempo && v.status === 'livre'
      );
      
      console.log('Local free voucher found:', localFreeVoucher);
      
      if (!localFreeVoucher) {
        toast({
          title: 'Sem vouchers disponíveis',
          description: `Não há vouchers de ${tempo} disponíveis`,
          variant: 'destructive',
        });
        return null;
      }

      const { error: insertError } = await supabase
        .from('vouchers')
        .update({
          status: 'pre-reservado',
          data_uso: getBrazilISOString(),
        })
        .eq('voucher_id', localFreeVoucher.voucher_id);

      if (insertError) throw insertError;

      await fetchVouchers();
      return localFreeVoucher;
    } catch (error) {
      console.error('Erro ao usar voucher:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar o voucher',
        variant: 'destructive',
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  // Get free vouchers without marking them (used before printing)
  const getFreVouchersBatch = (
    items: { tempo: string; quantity: number }[]
  ): Voucher[] => {
    const selected: Voucher[] = [];

    for (const item of items) {
      const freeOfTempo = vouchers.filter(
        v => v.tempo_validade === item.tempo && v.status === 'livre'
          && !selected.find(u => u.id === v.id)
      );

      const toUse = freeOfTempo.slice(0, item.quantity);
      if (toUse.length < item.quantity) {
        toast({
          title: 'Vouchers insuficientes',
          description: `Apenas ${toUse.length} voucher(s) de ${item.tempo} disponíveis.`,
          variant: 'destructive',
        });
      }
      selected.push(...toUse);
    }

    return selected;
  };

  // Mark vouchers as pre-reservado after successful printing
  const markVouchersPreReservado = async (voucherIds: string[]): Promise<boolean> => {
    const supabase = await getSupabaseClient();
    setProcessing(true);
    try {
      const dataUso = getBrazilISOString();
      for (let i = 0; i < voucherIds.length; i += 100) {
        const chunk = voucherIds.slice(i, i + 100);
        const updatePromises = chunk.map(vid =>
          supabase
            .from('vouchers')
            .update({ status: 'pre-reservado', data_uso: dataUso })
            .eq('voucher_id', vid)
        );
        const results = await Promise.all(updatePromises);
        for (const { error } of results) {
          if (error) {
            console.error('Erro ao atualizar voucher:', error);
          }
        }
      }
      await fetchVouchers();
      return true;
    } catch (error) {
      console.error('Erro ao marcar vouchers:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao marcar os vouchers',
        variant: 'destructive',
      });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Legacy batch function (kept for compatibility but now split into get + mark)
  const useVouchersBatch = async (
    items: { tempo: string; quantity: number }[]
  ): Promise<Voucher[]> => {
    const selected = getFreVouchersBatch(items);
    if (selected.length === 0) return [];
    await markVouchersPreReservado(selected.map(v => v.voucher_id));
    return selected;
  };

  const getUsedVouchersByDateRange = useCallback(
    async (startDate: Date | null, endDate: Date | null) => {
      const supabase = await getSupabaseClient();
      try {
        let query = supabase
          .from('vouchers')
          .select('*')
          .eq('status', 'usado')
          .not('data_uso', 'is', null);

        if (startDate) {
          query = query.gte('data_uso', startDate.toISOString());
        }

        if (endDate) {
          const nextDay = new Date(endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          query = query.lt('data_uso', nextDay.toISOString());
        }

        const { data, error } = await query.order('data_uso', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('Erro ao buscar vouchers usados:', error);
        return [];
      }
    },
    []
  );

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  return {
    vouchers,
    stats,
    loading,
    processing,
    importVouchers,
    useVoucher,
    useVouchersBatch,
    getFreVouchersBatch,
    markVouchersPreReservado,
    getUsedVouchersByDateRange,
    refetch: fetchVouchers,
  };
}
