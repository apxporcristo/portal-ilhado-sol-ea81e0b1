import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, ClipboardList } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase-external';

interface AuditoriaEntry {
  id: string;
  comanda_id: string;
  item_id: string | null;
  tipo: string;
  descricao: string;
  usuario_email: string;
  usuario_nome: string | null;
  usuario_cpf: string | null;
  created_at: string;
  comanda_numero?: number;
}

export function AuditoriaComandas() {
  const [entries, setEntries] = useState<AuditoriaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAuditoria = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = await getSupabaseClient();
      const { data } = await supabase
        .from('comanda_alteracoes' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (data) {
        // Fetch comanda numbers
        const comandaIds = [...new Set((data as any[]).map((d: any) => d.comanda_id))];
        const { data: comandas } = await supabase
          .from('comandas' as any)
          .select('id, numero')
          .in('id', comandaIds);
        
        const numeroMap: Record<string, number> = {};
        if (comandas) {
          (comandas as any[]).forEach((c: any) => { numeroMap[c.id] = c.numero; });
        }

        setEntries((data as any[]).map((d: any) => ({
          ...d,
          comanda_numero: numeroMap[d.comanda_id] || null,
        })));
      }
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuditoria(); }, [fetchAuditoria]);

  const filtered = search.trim()
    ? entries.filter(e => {
        const q = search.toLowerCase();
        return (
          (e.descricao || '').toLowerCase().includes(q) ||
          (e.usuario_nome || '').toLowerCase().includes(q) ||
          (e.usuario_cpf || '').toLowerCase().includes(q) ||
          (e.usuario_email || '').toLowerCase().includes(q) ||
          String(e.comanda_numero || '').includes(q)
        );
      })
    : entries;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Auditoria de Comandas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por comanda, atendente, CPF..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchAuditoria} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum registro de auditoria encontrado.</p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filtered.map(entry => {
              const date = new Date(entry.created_at);
              const dateStr = date.toLocaleDateString('pt-BR');
              const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={entry.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {entry.comanda_numero && (
                        <Badge variant="outline">Comanda #{entry.comanda_numero}</Badge>
                      )}
                      <Badge variant={entry.tipo === 'exclusao' ? 'destructive' : 'secondary'}>
                        {entry.tipo === 'exclusao' ? 'Exclusão' : 'Edição'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{dateStr} {timeStr}</span>
                  </div>
                  <p className="text-sm text-foreground">{entry.descricao}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Atendente: <strong>{entry.usuario_nome || entry.usuario_email}</strong></span>
                    {entry.usuario_cpf && <span>• CPF: {entry.usuario_cpf}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
