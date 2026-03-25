import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Save, Tag, Package, BarChart3, Filter, Search, Printer as PrinterIcon, Link2, Layers, Copy, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useFichasConsumo, FichaProduto, FichaCategoria } from '@/hooks/useFichasConsumo';
import { useComplementos, Complemento, ComplementoItem, GrupoComplemento } from '@/hooks/useComplementos';
import { useImpressoras, Impressora } from '@/hooks/useImpressoras';
import { getSupabaseClient } from '@/hooks/useVouchers';
import { useComandas, Comanda } from '@/hooks/useComandas';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function FichasAdmin() {
  const navigate = useNavigate();
  const {
    categorias, produtos, loading,
    createCategoria, updateCategoria, deleteCategoria,
    createProduto, updateProduto, deleteProduto,
  } = useFichasConsumo();
  const {
    complementos, items, grupos, produtoComplementos,
    loading: loadingComp,
    createComplemento, updateComplemento, deleteComplemento,
    createItem, updateItem, deleteItem,
    copyItems,
    createGrupo, updateGrupo, deleteGrupo, getGruposDaCategoria,
    vincularComplemento, desvincularComplemento, updateVinculoOrdem,
    getCategoriasOrdenadas, getItemsDaCategoria,
    refetch: refetchComp,
  } = useComplementos();
  const { impressoras } = useImpressoras();
  const impressorasAtivas = impressoras.filter(p => p.ativa);

  // Product form
  const [prodForm, setProdForm] = useState({ categoria_id: '', nome_produto: '', valor: '', ativo: true, tem_complementos: false, printer_id: '', forma_venda: 'unitario', valor_por_kg: '', obs: '' });
  const [editProd, setEditProd] = useState<FichaProduto | null>(null);
  const [deleteProdId, setDeleteProdId] = useState<string | null>(null);
  const [filterAtivo, setFilterAtivo] = useState<'all' | 'true' | 'false'>('all');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [savingProd, setSavingProd] = useState(false);
  const [searchProd, setSearchProd] = useState('');
  const [showProdModal, setShowProdModal] = useState(false);
  const [searchCat, setSearchCat] = useState('');
  const [searchComp, setSearchComp] = useState('');

  // Vínculo modal
  const [vinculoProdId, setVinculoProdId] = useState<string | null>(null);

  // Category form
  const [catForm, setCatForm] = useState({ nome_categoria: '', ativo: true, exigir_dados_cliente: false, exigir_dados_atendente: false });
  const [editCat, setEditCat] = useState<FichaCategoria | null>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [savingCat, setSavingCat] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);

  // Complemento (categoria de complemento) form
  const [compForm, setCompForm] = useState({ nome: '' });
  const [editComp, setEditComp] = useState<Complemento | null>(null);
  const [deleteCompId, setDeleteCompId] = useState<string | null>(null);
  const [savingComp, setSavingComp] = useState(false);
  const [showCompModal, setShowCompModal] = useState(false);

  // Items modal
  const [itemModalCompId, setItemModalCompId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ nome: '', valor: '', grupo_id: '', escolha_exclusiva: false });
  const [editItemObj, setEditItemObj] = useState<ComplementoItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [copyFromCompId, setCopyFromCompId] = useState<string | null>(null);

  // Grupo management
  const [showGrupoModal, setShowGrupoModal] = useState(false);
  const [grupoForm, setGrupoForm] = useState({ nome_grupo: '', tipo_selecao: 'single' as 'single' | 'multi', min_escolhas: '1', max_escolhas: '' });
  const [editGrupo, setEditGrupo] = useState<GrupoComplemento | null>(null);
  const [deleteGrupoId, setDeleteGrupoId] = useState<string | null>(null);
  const [savingGrupo, setSavingGrupo] = useState(false);
  const [grupoManageCatId, setGrupoManageCatId] = useState<string | null>(null);

  // Track which products have been printed and their print counts
  const [printedProdIds, setPrintedProdIds] = useState<Set<string>>(new Set());
  const [printCounts, setPrintCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchPrinted = async () => {
      const supabase = await getSupabaseClient();
      const { data } = await supabase.from('fichas_impressas').select('produto_id, quantidade');
      if (data) {
        const ids = new Set<string>();
        const counts: Record<string, number> = {};
        (data as any[]).forEach((r) => {
          ids.add(r.produto_id);
          counts[r.produto_id] = (counts[r.produto_id] || 0) + Number(r.quantidade);
        });
        setPrintedProdIds(ids);
        setPrintCounts(counts);
      }
    };
    fetchPrinted();
  }, [produtos]);

  const isPrinted = (id: string) => printedProdIds.has(id);

  const isNameSimilar = (original: string, updated: string) => {
    const a = original.trim().toLowerCase();
    const b = updated.trim().toLowerCase();
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const wordsA = a.split(/\s+/).filter(w => w.length >= 3);
    const wordsB = b.split(/\s+/).filter(w => w.length >= 3);
    const sharedWords = wordsA.some(w => wordsB.includes(w));
    if (sharedWords) return true;
    const bigrams = (s: string) => { const b: string[] = []; for (let i = 0; i < s.length - 1; i++) b.push(s.slice(i, i + 2)); return b; };
    const bg1 = bigrams(a), bg2 = bigrams(b);
    const intersection = bg1.filter(b => bg2.includes(b)).length;
    const similarity = (2 * intersection) / (bg1.length + bg2.length);
    return similarity >= 0.5;
  };

  const getCatName = (id: string) => categorias.find(c => c.id === id)?.nome_categoria || '—';

  const filteredCategorias = useMemo(() => {
    if (!searchCat.trim()) return categorias;
    const q = searchCat.trim().toLowerCase();
    return categorias.filter(c => c.nome_categoria.toLowerCase().includes(q));
  }, [categorias, searchCat]);

  const filteredComplementos = useMemo(() => {
    if (!searchComp.trim()) return complementos;
    const q = searchComp.trim().toLowerCase();
    return complementos.filter(c => c.nome.toLowerCase().includes(q));
  }, [complementos, searchComp]);

  const filteredProdutos = useMemo(() => {
    let list = [...produtos];
    if (filterAtivo === 'true') list = list.filter(p => p.ativo);
    if (filterAtivo === 'false') list = list.filter(p => !p.ativo);
    if (filterCategoria !== 'all') list = list.filter(p => p.categoria_id === filterCategoria);
    if (searchProd.trim()) {
      const q = searchProd.trim().toLowerCase();
      list = list.filter(p => p.nome_produto.toLowerCase().includes(q) || getCatName(p.categoria_id).toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
  }, [produtos, filterAtivo, filterCategoria, searchProd, categorias]);

  // Product handlers
  const handleSaveProd = async () => {
    const valorNum = parseFloat(String(prodForm.valor).replace(',', '.')) || 0;
    if (!prodForm.categoria_id || !prodForm.nome_produto.trim()) {
      toast({ title: 'Erro', description: 'Preencha categoria e nome do produto.', variant: 'destructive' });
      return;
    }
    if (!prodForm.tem_complementos && valorNum <= 0) {
      toast({ title: 'Erro', description: 'Valor obrigatório quando complementos não está ativado.', variant: 'destructive' });
      return;
    }
    setSavingProd(true);
    try {
      if (editProd) {
        const updateData: any = {
          categoria_id: prodForm.categoria_id,
          valor: parseFloat(String(prodForm.valor).replace(',', '.')) || 0,
          ativo: prodForm.ativo,
          tem_complementos: prodForm.tem_complementos,
          printer_id: prodForm.printer_id || null,
          forma_venda: prodForm.forma_venda,
          valor_por_kg: prodForm.forma_venda === 'por_peso' ? parseFloat(prodForm.valor_por_kg) || 0 : 0,
          obs: prodForm.obs.trim() || null,
        };
        if (isPrinted(editProd.id) && !isNameSimilar(editProd.nome_produto, prodForm.nome_produto.trim())) {
          toast({ title: 'Nome não pode ser alterado', description: 'Este produto já foi impresso. Apenas correções pequenas são permitidas.', variant: 'destructive' });
          setSavingProd(false);
          return;
        }
        updateData.nome_produto = prodForm.nome_produto.trim();
        await updateProduto(editProd.id, updateData);
        setEditProd(null);
        setShowProdModal(false);
        toast({ title: 'Produto atualizado!' });
      } else {
        await createProduto({
          categoria_id: prodForm.categoria_id,
          nome_produto: prodForm.nome_produto.trim(),
          valor: parseFloat(String(prodForm.valor).replace(',', '.')) || 0,
          tem_complementos: prodForm.tem_complementos,
          printer_id: prodForm.printer_id || null,
          forma_venda: prodForm.forma_venda,
          valor_por_kg: prodForm.forma_venda === 'por_peso' ? parseFloat(prodForm.valor_por_kg) || 0 : 0,
          obs: prodForm.obs.trim() || null,
        } as any);
        setShowProdModal(false);
        toast({ title: 'Produto cadastrado!' });
      }
      setProdForm({ categoria_id: '', nome_produto: '', valor: '', ativo: true, tem_complementos: false, printer_id: '', forma_venda: 'unitario', valor_por_kg: '', obs: '' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar produto', description: err?.message || 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setSavingProd(false);
    }
  };

  const startEditProd = (p: FichaProduto) => {
    setEditProd(p);
    setProdForm({
      categoria_id: p.categoria_id,
      nome_produto: p.nome_produto,
      valor: String(p.valor),
      ativo: p.ativo,
      tem_complementos: (p as any).tem_complementos ?? false,
      printer_id: p.printer_id || '',
      forma_venda: p.forma_venda || 'unitario',
      valor_por_kg: p.valor_por_kg ? String(p.valor_por_kg) : '',
      obs: (p as any).obs || '',
    });
    setShowProdModal(true);
  };

  const handleDeleteProd = async () => {
    if (!deleteProdId) return;
    try {
      await deleteProduto(deleteProdId);
      toast({ title: 'Produto excluído!' });
    } catch {
      toast({ title: 'Erro ao excluir.', variant: 'destructive' });
    }
    setDeleteProdId(null);
  };

  const toggleProdAtivo = async (p: FichaProduto) => {
    await updateProduto(p.id, { ativo: !p.ativo });
    toast({ title: p.ativo ? 'Produto desativado' : 'Produto ativado' });
  };

  // Category handlers
  const handleSaveCat = async () => {
    if (!catForm.nome_categoria.trim()) {
      toast({ title: 'Erro', description: 'Nome da categoria é obrigatório.', variant: 'destructive' });
      return;
    }
    setSavingCat(true);
    try {
      if (editCat) {
        await updateCategoria(editCat.id, {
          nome_categoria: catForm.nome_categoria.trim(),
          ativo: catForm.ativo,
          exigir_dados_cliente: catForm.exigir_dados_cliente,
          exigir_dados_atendente: catForm.exigir_dados_atendente,
        });
        setEditCat(null);
        setShowCatModal(false);
        toast({ title: 'Categoria atualizada!' });
      } else {
        await createCategoria(catForm.nome_categoria.trim(), catForm.exigir_dados_cliente, catForm.exigir_dados_atendente);
        setShowCatModal(false);
        toast({ title: 'Categoria cadastrada!' });
      }
      setCatForm({ nome_categoria: '', ativo: true, exigir_dados_cliente: false, exigir_dados_atendente: false });
    } catch {
      toast({ title: 'Erro ao salvar categoria.', variant: 'destructive' });
    } finally {
      setSavingCat(false);
    }
  };

  const startEditCat = (c: FichaCategoria) => {
    setEditCat(c);
    setCatForm({
      nome_categoria: c.nome_categoria,
      ativo: c.ativo,
      exigir_dados_cliente: c.exigir_dados_cliente,
      exigir_dados_atendente: c.exigir_dados_atendente,
    });
    setShowCatModal(true);
  };

  const handleDeleteCat = async () => {
    if (!deleteCatId) return;
    try {
      await deleteCategoria(deleteCatId);
      toast({ title: 'Categoria excluída!' });
    } catch {
      toast({ title: 'Erro ao excluir. Remova os produtos desta categoria primeiro.', variant: 'destructive' });
    }
    setDeleteCatId(null);
  };

  const toggleCatAtivo = async (c: FichaCategoria) => {
    await updateCategoria(c.id, { ativo: !c.ativo });
    toast({ title: c.ativo ? 'Categoria desativada' : 'Categoria ativada' });
  };

  // Complemento (categoria de complemento) handlers
  const handleSaveComp = async () => {
    if (!compForm.nome.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    setSavingComp(true);
    try {
      if (editComp) {
        await updateComplemento(editComp.id, { nome: compForm.nome.trim() });
        setEditComp(null);
        setShowCompModal(false);
        toast({ title: 'Categoria de complemento atualizada!' });
      } else {
        await createComplemento(compForm.nome.trim());
        setShowCompModal(false);
        toast({ title: 'Categoria de complemento cadastrada!' });
      }
      setCompForm({ nome: '' });
    } catch {
      toast({ title: 'Erro ao salvar.', variant: 'destructive' });
    } finally {
      setSavingComp(false);
    }
  };

  const handleDeleteComp = async () => {
    if (!deleteCompId) return;
    try {
      await deleteComplemento(deleteCompId);
      toast({ title: 'Categoria de complemento excluída!' });
    } catch {
      toast({ title: 'Erro ao excluir.', variant: 'destructive' });
    }
    setDeleteCompId(null);
  };

  const toggleCompAtivo = async (c: Complemento) => {
    await updateComplemento(c.id, { ativo: !c.ativo });
    toast({ title: c.ativo ? 'Desativada' : 'Ativada' });
  };

  // Items handlers
  const handleSaveItem = async () => {
    if (!itemModalCompId || !itemForm.nome.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    setSavingItem(true);
    try {
      if (editItemObj) {
        await updateItem(editItemObj.id, { nome: itemForm.nome.trim(), valor: parseFloat(itemForm.valor) || 0, grupo_id: itemForm.grupo_id || null, escolha_exclusiva: itemForm.escolha_exclusiva });
        setEditItemObj(null);
        toast({ title: 'Item atualizado!' });
      } else {
        await createItem(itemModalCompId, itemForm.nome.trim(), parseFloat(itemForm.valor) || 0, itemForm.grupo_id || null, itemForm.escolha_exclusiva);
        toast({ title: 'Item cadastrado!' });
      }
      setItemForm({ nome: '', valor: '', grupo_id: '', escolha_exclusiva: false });
    } catch {
      toast({ title: 'Erro ao salvar.', variant: 'destructive' });
    } finally {
      setSavingItem(false);
    }
  };

  // Grupo handlers
  const handleSaveGrupo = async () => {
    if (!grupoManageCatId || !grupoForm.nome_grupo.trim()) {
      toast({ title: 'Erro', description: 'Nome do grupo é obrigatório.', variant: 'destructive' });
      return;
    }
    setSavingGrupo(true);
    try {
      const min = parseInt(grupoForm.min_escolhas) || 0;
      const max = grupoForm.max_escolhas ? parseInt(grupoForm.max_escolhas) : null;
      if (editGrupo) {
        await updateGrupo(editGrupo.id, { nome_grupo: grupoForm.nome_grupo.trim(), tipo_selecao: grupoForm.tipo_selecao, min_escolhas: min, max_escolhas: max });
        setEditGrupo(null);
        toast({ title: 'Grupo atualizado!' });
      } else {
        await createGrupo(grupoManageCatId, grupoForm.nome_grupo.trim(), grupoForm.tipo_selecao, min, max);
        toast({ title: 'Grupo cadastrado!' });
      }
      setGrupoForm({ nome_grupo: '', tipo_selecao: 'single', min_escolhas: '1', max_escolhas: '' });
      setShowGrupoModal(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar grupo', description: err?.message || 'Erro', variant: 'destructive' });
    } finally {
      setSavingGrupo(false);
    }
  };

  const handleDeleteGrupo = async () => {
    if (!deleteGrupoId) return;
    try {
      await deleteGrupo(deleteGrupoId);
      toast({ title: 'Grupo excluído!' });
    } catch {
      toast({ title: 'Erro ao excluir grupo.', variant: 'destructive' });
    }
    setDeleteGrupoId(null);
  };

  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    try {
      await deleteItem(deleteItemId);
      toast({ title: 'Item excluído!' });
    } catch {
      toast({ title: 'Erro ao excluir.', variant: 'destructive' });
    }
    setDeleteItemId(null);
  };

  const toggleItemAtivo = async (item: ComplementoItem) => {
    await updateItem(item.id, { ativo: !item.ativo });
    toast({ title: item.ativo ? 'Item desativado' : 'Item ativado' });
  };

  const handleCopyItems = async () => {
    if (!copyFromCompId || !itemModalCompId) return;
    try {
      const count = await copyItems(copyFromCompId, itemModalCompId);
      if (count > 0) {
        toast({ title: `${count} item(ns) copiado(s)!` });
      } else {
        toast({ title: 'Nenhum item novo para copiar.', variant: 'destructive' });
      }
      setCopyFromCompId(null);
    } catch {
      toast({ title: 'Erro ao copiar.', variant: 'destructive' });
    }
  };

  // Vínculo handlers
  const handleToggleVinculo = async (complemento_id: string) => {
    if (!vinculoProdId) return;
    const exists = produtoComplementos.some(pc => pc.produto_id === vinculoProdId && pc.categoria_id === complemento_id);
    try {
      if (exists) {
        await desvincularComplemento(vinculoProdId, complemento_id);
      } else {
        const currentVinculos = produtoComplementos.filter(pc => pc.produto_id === vinculoProdId);
        const nextOrdem = currentVinculos.length > 0 ? Math.max(...currentVinculos.map(v => v.ordem ?? 0)) + 1 : 0;
        await vincularComplemento(vinculoProdId, complemento_id, nextOrdem);
      }
    } catch (err: any) {
      console.error('Erro vínculo detalhado:', err?.message, err?.code, err?.details, err);
      toast({ title: 'Erro ao alterar vínculo: ' + (err?.message || 'desconhecido'), variant: 'destructive' });
    }
  };

  const handleOrdemChange = async (complemento_id: string, newOrdem: number) => {
    if (!vinculoProdId) return;
    try {
      await updateVinculoOrdem(vinculoProdId, complemento_id, newOrdem);
    } catch {
      toast({ title: 'Erro ao atualizar ordem.', variant: 'destructive' });
    }
  };

  const itemModalItems = itemModalCompId ? items.filter(s => s.categoria_id === itemModalCompId) : [];
  const itemModalCompName = itemModalCompId ? complementos.find(c => c.id === itemModalCompId)?.nome || '' : '';
  const otherComplementos = itemModalCompId ? complementos.filter(c => c.id !== itemModalCompId && items.some(s => s.categoria_id === c.id)) : [];
  const itemModalGrupos = itemModalCompId ? grupos.filter(g => g.categoria_id === itemModalCompId) : [];
  const getGrupoName = (grupoId: string | null) => {
    if (!grupoId) return null;
    return grupos.find(g => g.id === grupoId)?.nome_grupo || null;
  };

  // Get vinculos for the current product, sorted by ordem
  const vinculosDoProduct = vinculoProdId
    ? produtoComplementos.filter(pc => pc.produto_id === vinculoProdId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    : [];

  if (loading || loadingComp) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex-1">Administração de Fichas</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <Tabs defaultValue="categorias">
          <TabsList className="flex w-full overflow-x-auto max-w-full">
            <TabsTrigger value="categorias" className="flex items-center gap-1">
              <Tag className="h-4 w-4" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="produtos" className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="complementos" className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              Complementos
            </TabsTrigger>
            <TabsTrigger value="comandas" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" />
              Comandas
            </TabsTrigger>
            <TabsTrigger value="relatorio" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Relatório
            </TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Produtos cadastrados</h2>
              <Button onClick={() => { setEditProd(null); setProdForm({ categoria_id: '', nome_produto: '', valor: '', ativo: true, tem_complementos: false, printer_id: '', forma_venda: 'unitario', valor_por_kg: '', obs: '' }); setShowProdModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Incluir produto
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <Input
                placeholder="Buscar por nome ou categoria..."
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
                className="flex-1 max-w-md"
              />
              <Select value={filterAtivo} onValueChange={(v: any) => setFilterAtivo(v)}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Ativados</SelectItem>
                  <SelectItem value="false">Desativados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Compl.</TableHead>
                    <TableHead>Impressões</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProdutos.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum produto cadastrado.</TableCell></TableRow>
                  ) : (
                    filteredProdutos.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{getCatName(p.categoria_id)}</TableCell>
                        <TableCell className="font-medium">{p.nome_produto}</TableCell>
                        <TableCell>R$ {Number(p.valor).toFixed(2).replace('.', ',')}</TableCell>
                        <TableCell>
                          <Badge variant={p.ativo ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleProdAtivo(p)}>
                            {p.ativo ? 'Ativado' : 'Desativado'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(p as any).tem_complementos ? (
                            <Badge variant="outline" className="cursor-pointer" onClick={() => setVinculoProdId(p.id)}>
                              <Link2 className="h-3 w-3 mr-1" />
                              {produtoComplementos.filter(pc => pc.produto_id === p.id).length}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{printCounts[p.id] || 0}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => startEditProd(p)}><Pencil className="h-4 w-4" /></Button>
                          {isPrinted(p.id) ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button variant="ghost" size="icon" disabled><Lock className="h-4 w-4 text-muted-foreground" /></Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Produto já impresso, não pode ser excluído</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteProdId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* CATEGORIAS TAB */}
          <TabsContent value="categorias" className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Categorias cadastradas</h2>
              <Button onClick={() => { setEditCat(null); setCatForm({ nome_categoria: '', ativo: true, exigir_dados_cliente: false, exigir_dados_atendente: false }); setShowCatModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Incluir categoria
              </Button>
            </div>

            <Input
              placeholder="Buscar por nome da categoria..."
              value={searchCat}
              onChange={(e) => setSearchCat(e.target.value)}
              className="max-w-md"
            />

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Exige Cliente</TableHead>
                    <TableHead>Exige Atendente</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategorias.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma categoria encontrada.</TableCell></TableRow>
                  ) : (
                    filteredCategorias.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome_categoria}</TableCell>
                        <TableCell>
                          <Badge variant={c.ativo ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleCatAtivo(c)}>
                            {c.ativo ? 'Ativada' : 'Desativada'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.exigir_dados_cliente ? 'default' : 'outline'}>
                            {c.exigir_dados_cliente ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.exigir_dados_atendente ? 'default' : 'outline'}>
                            {c.exigir_dados_atendente ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => startEditCat(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteCatId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="complementos" className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Categorias de Complemento</h2>
              <Button onClick={() => { setEditComp(null); setCompForm({ nome: '' }); setShowCompModal(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Incluir complemento
              </Button>
            </div>

            <Input
              placeholder="Buscar por nome do complemento..."
              value={searchComp}
              onChange={(e) => setSearchComp(e.target.value)}
              className="max-w-md"
            />

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComplementos.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum complemento encontrado.</TableCell></TableRow>
                  ) : (
                    filteredComplementos.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>
                          <Badge variant={c.ativo ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleCompAtivo(c)}>
                            {c.ativo ? 'Ativada' : 'Desativada'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => { setItemModalCompId(c.id); setItemForm({ nome: '', valor: '', grupo_id: '', escolha_exclusiva: false }); setEditItemObj(null); }}>
                            <Layers className="h-3 w-3 mr-1" />
                            {items.filter(s => s.categoria_id === c.id).length} itens
                          </Button>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditComp(c); setCompForm({ nome: c.nome }); setShowCompModal(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteCompId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* RELATÓRIO TAB */}
          <TabsContent value="relatorio" className="mt-6">
            <RelatorioFichasTab />
          </TabsContent>

          <TabsContent value="comandas" className="mt-6">
            <ComandasAdminTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Produto */}
      <Dialog open={showProdModal} onOpenChange={(open) => { if (!open) { setShowProdModal(false); setEditProd(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editProd ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={prodForm.categoria_id} onValueChange={(v) => setProdForm(p => ({ ...p, categoria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {categorias.filter(c => c.ativo).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_categoria}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do produto *</Label>
                <Input value={prodForm.nome_produto} onChange={(e) => setProdForm(p => ({ ...p, nome_produto: e.target.value.slice(0, 50) }))} placeholder="Ex: Coca-Cola Lata" maxLength={50} />
                {editProd && isPrinted(editProd.id) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Produto já impresso — apenas pequenas correções no nome
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" min="0" step="0.01" value={prodForm.valor} onChange={(e) => setProdForm(p => ({ ...p, valor: e.target.value.slice(0, 5) }))} placeholder="0.00" maxLength={5} className="w-24" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={prodForm.ativo} onCheckedChange={(v) => setProdForm(p => ({ ...p, ativo: v }))} />
                <Label>Ativado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={prodForm.tem_complementos} onCheckedChange={(v) => setProdForm(p => ({ ...p, tem_complementos: v }))} />
                <Label>Complementos</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>Forma de venda</Label>
                <Select value={prodForm.forma_venda} onValueChange={(v) => setProdForm(p => ({ ...p, forma_venda: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unitario">Unitário</SelectItem>
                    <SelectItem value="por_peso">Por peso (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impressora</Label>
                <Select value={prodForm.printer_id} onValueChange={(v) => setProdForm(p => ({ ...p, printer_id: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Usar padrão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhuma (usar padrão)</SelectItem>
                    {impressorasAtivas.map(imp => (
                      <SelectItem key={imp.id} value={imp.id}>{imp.nome} ({imp.tipo})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {prodForm.forma_venda === 'por_peso' && (
              <div className="space-y-2">
                <Label>Valor por kg (R$)</Label>
                <Input type="number" min="0" step="0.01" value={prodForm.valor_por_kg} onChange={(e) => setProdForm(p => ({ ...p, valor_por_kg: e.target.value }))} placeholder="0.00" className="w-28" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Observação <span className="text-muted-foreground text-xs">(opcional, aparece na ficha)</span></Label>
              <Input value={prodForm.obs} onChange={(e) => setProdForm(p => ({ ...p, obs: e.target.value }))} placeholder="Ex: Acompanha arroz e salada" maxLength={100} />
            </div>
            {prodForm.tem_complementos && (
              editProd ? (
                <Button variant="outline" onClick={() => setVinculoProdId(editProd.id)}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Gerenciar Categorias Vinculadas
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Salve o produto primeiro para vincular categorias de complementos.</p>
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowProdModal(false); setEditProd(null); setProdForm({ categoria_id: '', nome_produto: '', valor: '', ativo: true, tem_complementos: false, printer_id: '', forma_venda: 'unitario', valor_por_kg: '', obs: '' }); }}>Cancelar</Button>
            <Button onClick={handleSaveProd} disabled={savingProd}>
              <Save className="h-4 w-4 mr-2" />
              {editProd ? 'Salvar alterações' : 'Cadastrar produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Categoria */}
      <Dialog open={showCatModal} onOpenChange={(open) => { if (!open) { setShowCatModal(false); setEditCat(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da categoria *</Label>
                <Input value={catForm.nome_categoria} onChange={(e) => setCatForm(p => ({ ...p, nome_categoria: e.target.value }))} placeholder="Ex: Bebidas" />
              </div>
              {editCat && (
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={catForm.ativo} onCheckedChange={(v) => setCatForm(p => ({ ...p, ativo: v }))} />
                  <Label>Ativado</Label>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Exigir dados do cliente</Label>
                  <p className="text-sm text-muted-foreground">Nome, documento e telefone do cliente na impressão</p>
                </div>
                <Switch checked={catForm.exigir_dados_cliente} onCheckedChange={(v) => setCatForm(p => ({ ...p, exigir_dados_cliente: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Exigir dados do atendente</Label>
                  <p className="text-sm text-muted-foreground">Nome e código do atendente na impressão</p>
                </div>
                <Switch checked={catForm.exigir_dados_atendente} onCheckedChange={(v) => setCatForm(p => ({ ...p, exigir_dados_atendente: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCatModal(false); setEditCat(null); setCatForm({ nome_categoria: '', ativo: true, exigir_dados_cliente: false, exigir_dados_atendente: false }); }}>Cancelar</Button>
            <Button onClick={handleSaveCat} disabled={savingCat}>
              <Save className="h-4 w-4 mr-2" />
              {editCat ? 'Salvar alterações' : 'Cadastrar categoria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Complemento */}
      <Dialog open={showCompModal} onOpenChange={(open) => { if (!open) { setShowCompModal(false); setEditComp(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editComp ? 'Editar Categoria de Complemento' : 'Nova Categoria de Complemento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={compForm.nome} onChange={(e) => setCompForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Molho, Tamanho, Extras" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCompModal(false); setEditComp(null); setCompForm({ nome: '' }); }}>Cancelar</Button>
            <Button onClick={handleSaveComp} disabled={savingComp}>
              <Save className="h-4 w-4 mr-2" />
              {editComp ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialogs */}
      <ConfirmDialog open={!!deleteProdId} onOpenChange={(open) => !open && setDeleteProdId(null)} title="Excluir produto" description="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita." onConfirm={handleDeleteProd} />
      <ConfirmDialog open={!!deleteCatId} onOpenChange={(open) => !open && setDeleteCatId(null)} title="Excluir categoria" description="Tem certeza que deseja excluir esta categoria? Todos os produtos associados serão removidos." onConfirm={handleDeleteCat} />
      <ConfirmDialog open={!!deleteCompId} onOpenChange={(open) => !open && setDeleteCompId(null)} title="Excluir categoria de complemento" description="Tem certeza? Todos os itens e vínculos serão removidos." onConfirm={handleDeleteComp} />
      <ConfirmDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)} title="Excluir item" description="Tem certeza que deseja excluir este item?" onConfirm={handleDeleteItem} />

      {/* Modal vincular categorias de complemento ao produto */}
      <Dialog open={!!vinculoProdId} onOpenChange={(open) => !open && setVinculoProdId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorias de Complemento do Produto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Marque as categorias e defina a ordem de exibição na ficha.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {complementos.filter(c => c.ativo).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria ativa. Cadastre na aba Complementos.</p>
            ) : (
              complementos.filter(c => c.ativo).map(c => {
                const vinculo = produtoComplementos.find(pc => pc.produto_id === vinculoProdId && pc.categoria_id === c.id);
                const isLinked = !!vinculo;
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-muted/50 rounded" onClick={() => handleToggleVinculo(c.id)}>
                      <Checkbox checked={isLinked} />
                      <span className="font-medium">{c.nome}</span>
                      <span className="text-muted-foreground text-xs">({items.filter(i => i.categoria_id === c.id && i.ativo).length} itens)</span>
                    </div>
                    {isLinked && (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Ordem:</Label>
                        <Input
                          type="number"
                          min="0"
                          value={vinculo?.ordem ?? 0}
                          onChange={(e) => handleOrdemChange(c.id, parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-center text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVinculoProdId(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal itens da categoria de complemento */}
      <Dialog open={!!itemModalCompId} onOpenChange={(open) => { if (!open) { setItemModalCompId(null); setCopyFromCompId(null); setGrupoManageCatId(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Itens de "{itemModalCompName}"</DialogTitle>
          </DialogHeader>

          {/* Form */}
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input value={itemForm.nome} onChange={(e) => setItemForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do item" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={itemForm.valor} onChange={(e) => setItemForm(p => ({ ...p, valor: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={itemForm.escolha_exclusiva} onCheckedChange={(v) => setItemForm(p => ({ ...p, escolha_exclusiva: !!v }))} />
            <Label className="text-xs">Escolha exclusiva <span className="text-muted-foreground">(só pode escolher 1 entre os itens marcados)</span></Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveItem} disabled={savingItem}>
              <Save className="h-3 w-3 mr-1" />
              {editItemObj ? 'Salvar' : 'Adicionar'}
            </Button>
            {editItemObj && (
              <Button size="sm" variant="outline" onClick={() => { setEditItemObj(null); setItemForm({ nome: '', valor: '', grupo_id: '', escolha_exclusiva: false }); }}>Cancelar</Button>
            )}
          </div>

          {/* Copy from another */}
          {otherComplementos.length > 0 && (
            <div className="flex items-center gap-2 border-t pt-3">
              <Copy className="h-4 w-4 text-muted-foreground" />
              <Select value={copyFromCompId || ''} onValueChange={(v) => setCopyFromCompId(v || null)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Copiar de outra categoria..." /></SelectTrigger>
                <SelectContent>
                  {otherComplementos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} ({items.filter(s => s.categoria_id === c.id).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={handleCopyItems} disabled={!copyFromCompId}>Copiar</Button>
            </div>
          )}

          {/* List */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {itemModalItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado.</p>
            ) : (
              itemModalItems.map(s => {
                const grupoNome = getGrupoName(s.grupo_id);
                return (
                  <div key={s.id} className="flex items-center justify-between rounded border px-3 py-2">
                    <div className="flex flex-col">
                      <div>
                        <span className="text-sm font-medium">{s.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">R$ {Number(s.valor).toFixed(2).replace('.', ',')}</span>
                      </div>
                      {s.escolha_exclusiva && (
                        <Badge variant="outline" className="text-[10px] w-fit mt-0.5 border-orange-400 text-orange-600">⚡ Exclusiva</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={s.ativo ? 'default' : 'secondary'} className="cursor-pointer text-xs" onClick={() => toggleItemAtivo(s)}>
                        {s.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditItemObj(s); setItemForm({ nome: s.nome, valor: String(s.valor), grupo_id: s.grupo_id || '', escolha_exclusiva: s.escolha_exclusiva || false }); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteItemId(s.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setItemModalCompId(null); setCopyFromCompId(null); setGrupoManageCatId(null); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Inline Relatório Tab component
function RelatorioFichasTab() {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loadingRel, setLoadingRel] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  const [produtoFilter, setProdutoFilter] = useState('todos');

  const fetchRegistros = useCallback(async () => {
    setLoadingRel(true);
    const supabase = await getSupabaseClient();
    const { data } = await supabase.from('fichas_impressas' as any).select('*').order('created_at', { ascending: false });
    if (data) setRegistros(data as any[]);
    setLoadingRel(false);
  }, []);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const categoriasRel = useMemo(() => {
    const set = new Set<string>();
    registros.forEach(r => set.add(r.categoria_nome));
    return Array.from(set).sort();
  }, [registros]);

  const produtosUnicos = useMemo(() => {
    const set = new Set<string>();
    registros.forEach(r => set.add(r.produto_nome));
    return Array.from(set).sort();
  }, [registros]);

  const filtered = useMemo(() => {
    return registros.filter(r => {
      if (dataInicio && new Date(r.created_at) < new Date(dataInicio + 'T00:00:00')) return false;
      if (dataFim && new Date(r.created_at) > new Date(dataFim + 'T23:59:59')) return false;
      if (categoriaFilter !== 'todas' && r.categoria_nome !== categoriaFilter) return false;
      if (produtoFilter !== 'todos' && r.produto_nome !== produtoFilter) return false;
      return true;
    });
  }, [registros, dataInicio, dataFim, categoriaFilter, produtoFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, { produtos: Record<string, { quantidade: number; valor: number }>; subtotal: number; subtotalQtd: number }> = {};
    for (const r of filtered) {
      if (!map[r.categoria_nome]) map[r.categoria_nome] = { produtos: {}, subtotal: 0, subtotalQtd: 0 };
      const cat = map[r.categoria_nome];
      if (!cat.produtos[r.produto_nome]) cat.produtos[r.produto_nome] = { quantidade: 0, valor: 0 };
      cat.produtos[r.produto_nome].quantidade += r.quantidade;
      cat.produtos[r.produto_nome].valor += Number(r.valor_total);
      cat.subtotal += Number(r.valor_total);
      cat.subtotalQtd += r.quantidade;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalGeralQtd = grouped.reduce((sum, [, g]) => sum + g.subtotalQtd, 0);
  const totalGeralValor = grouped.reduce((sum, [, g]) => sum + g.subtotal, 0);
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  if (loadingRel) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
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
                {categoriasRel.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

      {grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([categoria, data]) => (
            <div key={categoria} className="bg-card border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-3 flex items-center justify-between">
                <Badge variant="secondary">{categoria}</Badge>
                <span className="text-sm font-semibold text-foreground">Subtotal: {fmt(data.subtotal)}</span>
              </div>
              <div className="divide-y">
                {Object.entries(data.produtos).sort(([a], [b]) => a.localeCompare(b)).map(([produto, info]) => (
                  <div key={produto} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-foreground">{produto}</span>
                      <span className="text-muted-foreground text-sm ml-2">× {info.quantidade}</span>
                    </div>
                    <span className="font-semibold text-foreground">{fmt(info.valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-primary/10 border-2 border-primary rounded-lg px-4 py-4 flex items-center justify-between">
            <div>
              <span className="font-bold text-foreground text-lg">Total Geral</span>
              <span className="text-muted-foreground text-sm ml-3">{totalGeralQtd} ficha(s)</span>
            </div>
            <span className="font-bold text-primary text-xl">{fmt(totalGeralValor)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ComandasAdminTab() {
  const { comandas, loading, createComanda, updateComanda, deleteComanda, refetch } = useComandas();
  const [form, setForm] = useState({ numero: '', observacao: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchComanda, setSearchComanda] = useState('');

  const filteredComandas = useMemo(() => {
    if (!searchComanda.trim()) return comandas;
    const q = searchComanda.trim().toLowerCase();
    return comandas.filter(c => String(c.numero).includes(q) || (c.observacao || '').toLowerCase().includes(q) || c.status.toLowerCase().includes(q));
  }, [comandas, searchComanda]);

  const handleSave = async () => {
    const num = parseInt(form.numero);
    if (!num || num <= 0) {
      toast({ title: 'Erro', description: 'Informe um número válido.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateComanda(editId, { observacao: form.observacao || null } as any);
        setEditId(null);
        toast({ title: 'Comanda atualizada!' });
      } else {
        await createComanda(num, form.observacao);
        toast({ title: 'Comanda cadastrada!' });
      }
      setForm({ numero: '', observacao: '' });
      setShowModal(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Erro ao salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteComanda(id);
      toast({ title: 'Comanda excluída!' });
    } catch {
      toast({ title: 'Erro ao excluir.', variant: 'destructive' });
    }
  };

  const toggleAtivo = async (c: Comanda) => {
    await updateComanda(c.id, { ativo: !c.ativo } as any);
    toast({ title: c.ativo ? 'Comanda desativada' : 'Comanda ativada' });
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Comandas cadastradas</h2>
        <Button onClick={() => { setEditId(null); setForm({ numero: '', observacao: '' }); setShowModal(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Incluir comanda
        </Button>
      </div>

      <Input
        placeholder="Buscar por número, status ou observação..."
        value={searchComanda}
        onChange={(e) => setSearchComanda(e.target.value)}
        className="max-w-md"
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredComandas.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma comanda encontrada.</TableCell></TableRow>
            ) : (
              filteredComandas.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">#{c.numero}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'aberta' ? 'default' : c.status === 'livre' ? 'secondary' : 'outline'}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.observacao || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => toggleAtivo(c)}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditId(c.id); setForm({ numero: String(c.numero), observacao: c.observacao || '' }); setShowModal(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {c.status === 'livre' && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Comanda */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) { setShowModal(false); setEditId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Comanda' : 'Nova Comanda'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input type="number" min="1" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="Ex: 1" disabled={!!editId} />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Mesa 5, VIP, etc." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); setEditId(null); setForm({ numero: '', observacao: '' }); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {editId ? 'Salvar alterações' : 'Cadastrar comanda'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
