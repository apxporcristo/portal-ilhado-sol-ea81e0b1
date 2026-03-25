import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Minus, Printer, Lock, X, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useComandas, Comanda, ComandaItem } from '@/hooks/useComandas';
import { useFormasPagamento, FormaPagamento } from '@/hooks/useFormasPagamento';
import { PagamentoDialog, PagamentoSelecionado } from '@/components/PagamentoDialog';
import { cn } from '@/lib/utils';
import { formatCPF, cleanCPF } from '@/lib/cpf-utils';
import { useOptionalUserSession } from '@/contexts/UserSessionContext';

interface Props {
  comanda: Comanda | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrintItems?: (items: ComandaItem[], comanda: Comanda) => void;
  onClosed?: () => void;
}

interface GroupedItem {
  key: string;
  produto_nome: string;
  quantidade: number;
  originalQuantidade: number;
  valor_unitario: number;
  valor_total: number;
  peso: number | null;
  complementos: any[] | null;
  itemIds: string[];
}

// Track pending changes: which item IDs to delete, and quantity decreases per group key
interface PendingChanges {
  deletes: string[]; // item IDs to fully delete
  decreases: Record<string, number>; // group key -> how many to decrease
  descriptions: string[]; // log descriptions
}

export function ComandaDetalhe({ comanda, open, onOpenChange, onPrintItems, onClosed }: Props) {
  const { getItensComanda, excluirItem, editarItem, registrarAlteracao, fecharComanda } = useComandas();
  const { formasAtivas } = useFormasPagamento();
  const sessionCtx = useOptionalUserSession();
  const loggedUser = sessionCtx?.access;

  const [items, setItems] = useState<ComandaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingChanges>({ deletes: [], decreases: {}, descriptions: [] });
  const [pendingPagamentos, setPendingPagamentos] = useState<PagamentoSelecionado[]>([]);

  // Close comanda
  const [showClose, setShowClose] = useState(false);

  useEffect(() => {
    if (open && comanda) {
      setLoading(true);
      getItensComanda(comanda.id).then(data => {
        setItems(data);
        setLoading(false);
      });
      setPending({ deletes: [], decreases: {}, descriptions: [] });
    }
  }, [open, comanda, getItensComanda]);

  const hasChanges = pending.deletes.length > 0 || Object.keys(pending.decreases).length > 0;

  // Get logged user info for audit
  const getAuditUser = () => {
    const email = loggedUser?.email || loggedUser?.cpf || 'sistema';
    const nome = loggedUser?.nome || null;
    const cpf = loggedUser?.cpf || null;
    return { email, nome, cpf };
  };

  const handleSaveChanges = async () => {
    if (!loggedUser) {
      toast({ title: 'Usuário não autenticado', description: 'Faça login para realizar alterações.', variant: 'destructive' });
      return;
    }
    const { email, nome, cpf } = getAuditUser();
    await executeSave(email, nome, cpf);
  };

  const handleCloseComanda = async (pagamentos: PagamentoSelecionado[]) => {
    if (!loggedUser) {
      toast({ title: 'Usuário não autenticado', description: 'Faça login para encerrar a comanda.', variant: 'destructive' });
      return;
    }
    const { email, nome, cpf } = getAuditUser();
    await executeClose(email, nome, pagamentos, cpf);
  };

  const executeSave = async (email: string, nome?: string | null, cpf?: string | null) => {
    if (!comanda) return;
    try {
      for (const id of pending.deletes) {
        await excluirItem(id);
      }
      for (const [key, dec] of Object.entries(pending.decreases)) {
        const groupItems = items.filter(i => {
          const compKey = i.complementos ? JSON.stringify(i.complementos) : '';
          return `${i.produto_nome}|${compKey}|${Number(i.valor_unitario)}` === key;
        });
        let remaining = dec;
        for (let idx = groupItems.length - 1; idx >= 0 && remaining > 0; idx--) {
          const item = groupItems[idx];
          if (item.quantidade <= remaining) {
            await excluirItem(item.id);
            remaining -= item.quantidade;
          } else {
            await editarItem(item.id, {
              quantidade: item.quantidade - remaining,
              valor_total: (item.quantidade - remaining) * Number(item.valor_unitario),
            } as any);
            remaining = 0;
          }
        }
      }
      for (const desc of pending.descriptions) {
        await registrarAlteracao(comanda.id, null, 'edicao', `${desc} [CPF: ${cpf || 'N/A'}]`, email, nome || undefined);
      }
      toast({ title: 'Alterações salvas' });
      setPending({ deletes: [], decreases: {}, descriptions: [] });
      onOpenChange(false);
      onClosed?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  const executeClose = async (email: string, nome?: string | null, pagamentos?: PagamentoSelecionado[], cpf?: string | null) => {
    if (!comanda || !pagamentos || pagamentos.length === 0) return;
    try {
      if (hasChanges) {
        await executeSave(email, nome, cpf);
      }
      const formaDesc = pagamentos.map(p => `${p.forma.nome}: R$ ${p.valor.toFixed(2).replace('.', ',')}`).join(' | ');
      await fecharComanda(comanda.id, pagamentos[0].forma.id, formaDesc, email, nome || undefined);
      // Additional audit with CPF
      await registrarAlteracao(
        comanda.id, null, 'edicao',
        `Comanda encerrada - ${formaDesc} [CPF: ${cpf || 'N/A'}]`,
        email, nome || undefined
      );
      toast({ title: 'Comanda encerrada com sucesso' });
      setShowClose(false);
      onOpenChange(false);
      onClosed?.();
    } catch (err: any) {
      toast({ title: 'Erro ao encerrar comanda', description: err?.message || String(err), variant: 'destructive' });
    }
  };

  // Grouped items and total
  const groupedItems = useMemo(() => {
    const activeItems = items.filter(i => !pending.deletes.includes(i.id));
    const groups: Record<string, GroupedItem> = {};
    for (const item of activeItems) {
      const compKey = item.complementos ? JSON.stringify(item.complementos) : '';
      const key = `${item.produto_nome}|${compKey}|${Number(item.valor_unitario)}`;
      if (groups[key]) {
        groups[key].quantidade += item.quantidade;
        groups[key].originalQuantidade += item.quantidade;
        groups[key].valor_total += Number(item.valor_total);
        groups[key].itemIds.push(item.id);
        if (item.peso) groups[key].peso = (groups[key].peso || 0) + item.peso;
      } else {
        groups[key] = {
          key,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          originalQuantidade: item.quantidade,
          valor_unitario: Number(item.valor_unitario),
          valor_total: Number(item.valor_total),
          peso: item.peso,
          complementos: item.complementos,
          itemIds: [item.id],
        };
      }
    }
    for (const [key, dec] of Object.entries(pending.decreases)) {
      if (groups[key]) {
        groups[key].quantidade -= dec;
        groups[key].valor_total = groups[key].quantidade * groups[key].valor_unitario;
      }
    }
    return Object.values(groups).filter(g => g.quantidade > 0);
  }, [items, pending]);

  const totalComanda = useMemo(() => groupedItems.reduce((sum, g) => sum + g.valor_total, 0), [groupedItems]);

  const handleDecrease = (group: GroupedItem) => {
    if (group.quantidade <= 1) return;
    setPending(prev => ({
      ...prev,
      decreases: { ...prev.decreases, [group.key]: (prev.decreases[group.key] || 0) + 1 },
      descriptions: [...prev.descriptions, `Quantidade diminuída: ${group.produto_nome} (-1)`],
    }));
  };

  const handleDeleteGroup = (group: GroupedItem) => {
    setPending(prev => ({
      ...prev,
      deletes: [...prev.deletes, ...group.itemIds],
      decreases: (() => { const d = { ...prev.decreases }; delete d[group.key]; return d; })(),
      descriptions: [...prev.descriptions, `Itens removidos: ${group.produto_nome} (${group.quantidade}x)`],
    }));
  };

  if (!comanda) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Comanda #{comanda.numero}
              <Badge variant={comanda.status === 'aberta' ? 'default' : 'secondary'}>{comanda.status}</Badge>
            </DialogTitle>
          </DialogHeader>

          {comanda.nome_cliente && (
            <div className="text-sm text-muted-foreground">
              <strong>Cliente:</strong> {comanda.nome_cliente}
              {comanda.telefone_cliente && ` • ${comanda.telefone_cliente}`}
            </div>
          )}

          <div className="space-y-0">
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Carregando...</p>
            ) : groupedItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhum item lançado.</p>
            ) : (
              groupedItems.map((group, idx) => {
                const complementos = (group.complementos as any[] | null) || [];
                const descLines: string[] = [];
                complementos.forEach((c: any) => {
                  if (c.nome) descLines.push(c.nome);
                });

                return (
                  <div key={group.key}>
                    <div className="flex items-start justify-between py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{group.produto_nome}</span>
                          <div className="flex items-center gap-1 ml-2">
                            <span className="text-sm font-bold text-primary whitespace-nowrap">
                              R$ {group.valor_total.toFixed(2).replace('.', ',')}
                            </span>
                            {comanda.status === 'aberta' && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteGroup(group)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {descLines.length > 0 && (
                          <span className="text-xs text-muted-foreground block mt-0.5">
                            {descLines.join(', ')}
                          </span>
                        )}
                        {group.peso && (
                          <span className="text-xs text-muted-foreground block">{group.peso.toFixed(3)} kg</span>
                        )}
                        <div className="flex items-center gap-1">
                          {comanda.status === 'aberta' && group.quantidade > 1 && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => handleDecrease(group)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {group.quantidade}x R$ {group.valor_unitario.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {idx < groupedItems.length - 1 && <div className="border-b border-dashed border-muted-foreground/30" />}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold text-primary">R$ {totalComanda.toFixed(2).replace('.', ',')}</span>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {onPrintItems && items.length > 0 && (
              <Button variant="outline" onClick={() => onPrintItems(items, comanda)} className="w-full sm:w-auto">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir detalhes
              </Button>
            )}
            {comanda.status === 'aberta' && (
              <Button variant="outline" onClick={() => {
                if (hasChanges) {
                  handleSaveChanges();
                } else {
                  onOpenChange(false);
                }
              }} className="w-full sm:w-auto">
                <X className="h-4 w-4 mr-2" />
                Fechar comanda
              </Button>
            )}
            {comanda.status === 'aberta' && totalComanda > 0 && (
              <Button variant="destructive" onClick={() => setShowClose(true)} className="w-full sm:w-auto">
                <CreditCard className="h-4 w-4 mr-2" />
                Encerrar comanda
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encerrar Comanda Dialog */}
      <PagamentoDialog
        open={showClose}
        onOpenChange={setShowClose}
        formasAtivas={formasAtivas}
        totalConta={totalComanda}
        titulo={`Encerrar Comanda #${comanda.numero}`}
        confirmLabel="Confirmar encerramento"
        confirmIcon={<Lock className="h-4 w-4 mr-2" />}
        onConfirm={(pagamentos) => {
          setShowClose(false);
          handleCloseComanda(pagamentos);
        }}
      />
    </>
  );
}