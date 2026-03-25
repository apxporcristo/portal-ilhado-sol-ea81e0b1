import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, Calendar } from 'lucide-react';
import { getSupabaseClient } from '@/hooks/useVouchers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface FichaImpressa {
  id: string;
  produto_id: string;
  produto_nome: string;
  categoria_id: string;
  categoria_nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  nome_cliente: string | null;
  nome_atendente: string | null;
  created_at: string;
}

export default function FichasRelatorio() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<FichaImpressa[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  const [produtoFilter, setProdutoFilter] = useState('todos');

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const supabase = await getSupabaseClient();
    const { data } = await supabase
      .from('fichas_impressas' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRegistros(data as unknown as FichaImpressa[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // Unique categories and products for filter dropdowns
  const categorias = useMemo(() => {
    const set = new Set<string>();
    registros.forEach(r => set.add(r.categoria_nome));
    return Array.from(set).sort();
  }, [registros]);

  const produtosUnicos = useMemo(() => {
    const set = new Set<string>();
    registros.forEach(r => set.add(r.produto_nome));
    return Array.from(set).sort();
  }, [registros]);

  // Filter logic
  const filtered = useMemo(() => {
    return registros.filter(r => {
      if (dataInicio) {
        const d = new Date(r.created_at);
        if (d < new Date(dataInicio + 'T00:00:00')) return false;
      }
      if (dataFim) {
        const d = new Date(r.created_at);
        if (d > new Date(dataFim + 'T23:59:59')) return false;
      }
      if (categoriaFilter !== 'todas' && r.categoria_nome !== categoriaFilter) return false;
      if (produtoFilter !== 'todos' && r.produto_nome !== produtoFilter) return false;
      return true;
    });
  }, [registros, dataInicio, dataFim, categoriaFilter, produtoFilter]);

  // Group by category, then by product
  const grouped = useMemo(() => {
    const map: Record<string, { produtos: Record<string, { quantidade: number; valor: number }>; subtotal: number; subtotalQtd: number }> = {};
    
    for (const r of filtered) {
      if (!map[r.categoria_nome]) {
        map[r.categoria_nome] = { produtos: {}, subtotal: 0, subtotalQtd: 0 };
      }
      const cat = map[r.categoria_nome];
      if (!cat.produtos[r.produto_nome]) {
        cat.produtos[r.produto_nome] = { quantidade: 0, valor: 0 };
      }
      cat.produtos[r.produto_nome].quantidade += r.quantidade;
      cat.produtos[r.produto_nome].valor += Number(r.valor_total);
      cat.subtotal += Number(r.valor_total);
      cat.subtotalQtd += r.quantidade;
    }

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalGeralQtd = useMemo(() => grouped.reduce((sum, [, g]) => sum + g.subtotalQtd, 0), [grouped]);
  const totalGeralValor = useMemo(() => grouped.reduce((sum, [, g]) => sum + g.subtotal, 0), [grouped]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Relatório de Fichas Impressas</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-card border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Produto</Label>
              <Select value={produtoFilter} onValueChange={setProdutoFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {produtosUnicos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Report */}
        {grouped.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum registro encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([categoria, data]) => (
              <div key={categoria} className="bg-card border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{categoria}</Badge>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    Subtotal: {fmt(data.subtotal)}
                  </span>
                </div>
                <div className="divide-y">
                  {Object.entries(data.produtos)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([produto, info]) => (
                      <div key={produto} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-foreground">{produto}</span>
                          <span className="text-muted-foreground text-sm ml-2">
                            × {info.quantidade}
                          </span>
                        </div>
                        <span className="font-semibold text-foreground">{fmt(info.valor)}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {/* Grand total */}
            <div className="bg-primary/10 border-2 border-primary rounded-lg px-4 py-4 flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground text-lg">Total Geral</span>
                <span className="text-muted-foreground text-sm ml-3">
                  {totalGeralQtd} ficha(s)
                </span>
              </div>
              <span className="font-bold text-primary text-xl">{fmt(totalGeralValor)}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
