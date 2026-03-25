import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ClipboardList, Phone, User, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useComandas, Comanda, ComandaItem } from '@/hooks/useComandas';
import { ComandaDetalhe } from '@/components/ComandaDetalhe';
import { toast } from '@/hooks/use-toast';

export default function ComandasLista() {
  const navigate = useNavigate();
  const { comandas, comandasAbertas, comandasLivres, loading, abrirComanda, getItensComanda, refetch } = useComandas();
  const [search, setSearch] = useState('');
  const [showAbrir, setShowAbrir] = useState(false);
  const [selectedComandaId, setSelectedComandaId] = useState('');
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [selectedComanda, setSelectedComanda] = useState<Comanda | null>(null);
  const [showDetalhe, setShowDetalhe] = useState(false);

  // Item counts per comanda
  const [itemCounts, setItemCounts] = useState<Record<string, { qty: number; total: number }>>({});

  useEffect(() => {
    const loadCounts = async () => {
      const counts: Record<string, { qty: number; total: number }> = {};
      for (const c of comandasAbertas) {
        const items = await getItensComanda(c.id);
        counts[c.id] = {
          qty: items.reduce((s, i) => s + i.quantidade, 0),
          total: items.reduce((s, i) => s + Number(i.valor_total), 0),
        };
      }
      setItemCounts(counts);
    };
    if (comandasAbertas.length > 0) loadCounts();
  }, [comandasAbertas, getItensComanda]);

  const filtered = useMemo(() => {
    if (!search.trim()) return comandasAbertas;
    const q = search.toLowerCase();
    return comandasAbertas.filter(c =>
      String(c.numero).includes(q) ||
      (c.nome_cliente || '').toLowerCase().includes(q) ||
      (c.telefone_cliente || '').toLowerCase().includes(q)
    );
  }, [comandasAbertas, search]);

  const handleAbrir = async () => {
    if (!selectedComandaId || !nomeCliente.trim()) {
      toast({ title: 'Preencha o nome do cliente', variant: 'destructive' });
      return;
    }
    try {
      await abrirComanda(selectedComandaId, nomeCliente.trim(), telefoneCliente.trim());
      toast({ title: 'Comanda aberta!' });
      setShowAbrir(false);
      setNomeCliente('');
      setTelefoneCliente('');
      setSelectedComandaId('');
    } catch {
      toast({ title: 'Erro ao abrir comanda', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/fichas')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Comandas Abertas</h1>
            <Badge variant="secondary">{comandasAbertas.length}</Badge>
          </div>
          <Button onClick={() => { setShowAbrir(true); setSelectedComandaId(''); setNomeCliente(''); setTelefoneCliente(''); }} disabled={comandasLivres.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Abrir Comanda
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, cliente ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? 'Nenhuma comanda encontrada.' : 'Nenhuma comanda aberta no momento.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(c => (
              <Card key={c.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => { setSelectedComanda(c); setShowDetalhe(true); }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      <span className="text-lg font-bold">#{c.numero}</span>
                    </div>
                    <Badge>Aberta</Badge>
                  </div>
                  {c.nome_cliente && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {c.nome_cliente}
                    </div>
                  )}
                  {c.telefone_cliente && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {c.telefone_cliente}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" />
                      {itemCounts[c.id]?.qty || 0} itens
                    </span>
                    <span className="font-bold text-primary">
                      R$ {(itemCounts[c.id]?.total || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Abrir Comanda Dialog */}
      <Dialog open={showAbrir} onOpenChange={setShowAbrir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Comanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comanda *</Label>
              <Select value={selectedComandaId} onValueChange={setSelectedComandaId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma comanda livre..." /></SelectTrigger>
                <SelectContent>
                  {comandasLivres.map(c => (
                    <SelectItem key={c.id} value={c.id}>#{c.numero}{c.observacao ? ` - ${c.observacao}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label>Telefone (opcional)</Label>
              <Input value={telefoneCliente} onChange={e => setTelefoneCliente(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbrir(false)}>Cancelar</Button>
            <Button onClick={handleAbrir} disabled={!selectedComandaId || !nomeCliente.trim()}>Confirmar Abertura</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comanda Detalhe */}
      <ComandaDetalhe comanda={selectedComanda} open={showDetalhe} onOpenChange={setShowDetalhe} onClosed={() => refetch()} />
    </div>
  );
}
