import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Plus } from 'lucide-react';
import { useVouchers } from '@/hooks/useVouchers';
import { usePrinterContext } from '@/contexts/PrinterContext';
import { useImpressoras, Impressora } from '@/hooks/useImpressoras';
import { useVoucherCart } from '@/hooks/useVoucherCart';
import { usePrintJobs } from '@/hooks/usePrintJobs';

import { VoucherCart } from '@/components/VoucherCart';
import { VoucherViewDialog } from '@/components/VoucherViewDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useOptionalUserSession } from '@/contexts/UserSessionContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bluetooth, Wifi, Printer } from 'lucide-react';

const timeColors: Record<string, string> = {
  '1 Hora': 'bg-time-1h hover:bg-time-1h/90',
  '2 Horas': 'bg-time-2h hover:bg-time-2h/90',
  '3 Horas': 'bg-time-3h hover:bg-time-3h/90',
  '4 Horas': 'bg-time-4h hover:bg-time-4h/90',
  '5 Horas': 'bg-time-5h hover:bg-time-5h/90',
  '6 Horas': 'bg-time-6h hover:bg-time-6h/90',
};

export default function VoucherLista() {
  const navigate = useNavigate();
  const sessionCtx = useOptionalUserSession();
  const userAccess = sessionCtx?.access;
  const isSpecificTempo = !!(userAccess?.acesso_voucher && userAccess?.voucher_tempo_acesso);
  const allowedTempo = userAccess?.voucher_tempo_acesso || null;

  const {
    stats, loading,
    getFreVouchersBatch, markVouchersPreReservado,
  } = useVouchers();

  const { createVoucherData } = usePrinterContext();
  const { impressoras, getVoucherPrinter } = useImpressoras();
  const { createPrintJobFromBinary } = usePrintJobs();
  const cart = useVoucherCart();
  const impressorasAtivas = impressoras.filter(p => p.ativa);

  const [showPrinterSelect, setShowPrinterSelect] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [viewVouchers, setViewVouchers] = useState<{ voucher_id: string; tempo_validade: string }[]>([]);

  const handleAddToCart = useCallback((tempo: string) => {
    const inCart = cart.items.find(i => i.tempo === tempo)?.quantity || 0;
    const available = stats.livresPorTempo[tempo] || 0;
    if (inCart >= available) {
      toast({ title: 'Limite atingido', description: `Todos os ${available} voucher(s) de ${tempo} já estão no carrinho.` });
      return;
    }
    cart.addItem(tempo);
  }, [cart, stats.livresPorTempo]);

  const executeBatchPrint = useCallback(async (printer: Impressora) => {
    setBatchPrinting(true);
    try {
      const voucherItems = cart.items;
      const selectedVouchers = voucherItems.length > 0 ? getFreVouchersBatch(voucherItems) : [];
      if (selectedVouchers.length === 0) { setBatchPrinting(false); return; }

      console.log('[Voucher Print] Impressora selecionada:', printer.nome, 'id:', printer.id);

      // Generate ESC/POS data and insert into print_jobs
      for (const v of selectedVouchers) {
        const escposData = await createVoucherData(v.voucher_id, v.tempo_validade);
        console.log('[Voucher Print] Job para voucher:', v.voucher_id, 'bytes:', escposData.length);
        await createPrintJobFromBinary({
          printer_id: printer.id,
          printer_name: printer.nome,
          device_ip: printer.ip || undefined,
          data: escposData,
          formato: 'escpos',
          tipo_documento: 'voucher',
          referencia_id: v.voucher_id,
        });
      }

      // Mark vouchers as pre-reserved
      await markVouchersPreReservado(selectedVouchers.map(v => v.voucher_id));
      toast({ title: 'Enviado para fila!', description: `${selectedVouchers.length} voucher(s) na fila de impressão.` });
      cart.clearCart();
    } catch (error) {
      console.error('Erro na impressão em lote:', error);
      toast({ title: 'Erro', description: 'Ocorreu um erro durante a impressão.', variant: 'destructive' });
    } finally {
      setBatchPrinting(false);
    }
  }, [cart, getFreVouchersBatch, markVouchersPreReservado, createVoucherData, createPrintJobFromBinary]);

  const handleBatchPrint = useCallback(async () => {
    if (impressorasAtivas.length === 0) {
      toast({ title: 'Nenhuma impressora disponível', description: 'Cadastre uma impressora nas configurações.', variant: 'destructive' });
      return;
    }
    // Show printer select modal
    setShowPrinterSelect(true);
  }, [impressorasAtivas]);

  const handlePrinterSelected = useCallback(async (printer: Impressora) => {
    setShowPrinterSelect(false);
    await executeBatchPrint(printer);
  }, [executeBatchPrint]);

  const handleViewVoucher = useCallback(async () => {
    setBatchPrinting(true);
    try {
      const voucherItems = cart.items;
      const selectedVouchers = voucherItems.length > 0 ? getFreVouchersBatch(voucherItems) : [];
      if (selectedVouchers.length === 0) { setBatchPrinting(false); return; }
      setViewVouchers(selectedVouchers.map(v => ({ voucher_id: v.voucher_id, tempo_validade: v.tempo_validade })));
    } catch (error) {
      console.error('Erro ao visualizar vouchers:', error);
      toast({ title: 'Erro', description: 'Ocorreu um erro ao gerar os vouchers.', variant: 'destructive' });
    } finally {
      setBatchPrinting(false);
    }
  }, [cart, getFreVouchersBatch]);

  const handleConfirmViewVouchers = useCallback(async () => {
    setBatchPrinting(true);
    try {
      const ids = viewVouchers.map(v => v.voucher_id);
      if (ids.length > 0) await markVouchersPreReservado(ids);
      toast({ title: 'Vouchers confirmados!', description: `${ids.length} voucher(s) marcados como pré-reservado.` });
      cart.clearCart();
      setViewVouchers([]);
    } catch (error) {
      console.error('Erro ao confirmar vouchers:', error);
      toast({ title: 'Erro', description: 'Ocorreu um erro ao confirmar os vouchers.', variant: 'destructive' });
    } finally {
      setBatchPrinting(false);
    }
  }, [viewVouchers, markVouchersPreReservado, cart]);

  const temposComVouchersLivres = stats.temposDisponiveis.filter(
    tempo => {
      if ((stats.livresPorTempo[tempo] || 0) <= 0) return false;
      if (isSpecificTempo && tempo !== allowedTempo) return false;
      return true;
    }
  );

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
        <div className="max-w-full mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Lista de Vouchers</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <Alert variant="default" className="border">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            {isSpecificTempo
              ? `Selecione vouchers de ${allowedTempo} e visualize na tela`
              : 'Selecione os vouchers desejados e imprima todos de uma vez'}
          </AlertDescription>
        </Alert>

        {temposComVouchersLivres.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {temposComVouchersLivres.map((tempo) => {
              const available = stats.livresPorTempo[tempo] || 0;
              const inCart = cart.items.find(i => i.tempo === tempo)?.quantity || 0;
              const colorClass = timeColors[tempo] || 'bg-primary hover:bg-primary/90';
              return (
                <Button key={tempo} onClick={() => handleAddToCart(tempo)} disabled={batchPrinting || inCart >= available}
                  className={cn('flex flex-col items-center justify-center h-32 w-full rounded-xl text-primary-foreground shadow-lg transition-all duration-300 transform hover:scale-105 relative', colorClass)}>
                  {inCart > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-sm px-2">{inCart}</Badge>
                  )}
                  <span className="text-xl font-bold mb-1">{tempo}</span>
                  <span className="text-sm opacity-90">{available} disponíveis</span>
                  <div className="flex items-center gap-1 mt-2 text-xs opacity-80">
                    <Plus className="h-4 w-4" /><span>Adicionar</span>
                  </div>
                </Button>
              );
            })}
          </div>
        ) : (
          <Alert className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Nenhum voucher disponível no momento.</AlertDescription>
          </Alert>
        )}

        <VoucherCart
          items={cart.items}
          onAdd={(tempo, opts) => cart.addItem(tempo, opts)}
          onRemove={(tempo, fichaType) => cart.removeItem(tempo, fichaType)}
          onRemoveAll={(tempo, fichaType) => cart.removeAll(tempo, fichaType)}
          onClear={cart.clearCart}
          onPrint={isSpecificTempo ? handleViewVoucher : handleBatchPrint}
          totalItems={cart.totalItems}
          printing={batchPrinting}
          availableByTempo={stats.livresPorTempo}
          viewMode={isSpecificTempo}
        />
      </main>

      {/* Printer select dialog using DB printers */}
      <Dialog open={showPrinterSelect} onOpenChange={setShowPrinterSelect}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Selecionar Impressora
            </DialogTitle>
            <DialogDescription>
              Escolha em qual impressora deseja imprimir o voucher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {impressorasAtivas.map((imp) => (
              <Button
                key={imp.id}
                variant="outline"
                className="w-full justify-start gap-3 h-14"
                onClick={() => handlePrinterSelected(imp)}
              >
                {imp.tipo === 'bluetooth' ? (
                  <Bluetooth className="h-5 w-5 text-blue-500" />
                ) : (
                  <Wifi className="h-5 w-5 text-green-500" />
                )}
                <div className="text-left">
                  <div className="font-medium">{imp.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {imp.tipo === 'bluetooth' ? 'Bluetooth' : `Rede ${imp.ip || ''}`}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <VoucherViewDialog
        open={viewVouchers.length > 0}
        onOpenChange={(open) => { if (!open) setViewVouchers([]); }}
        vouchers={viewVouchers}
        onConfirm={handleConfirmViewVouchers}
        confirming={batchPrinting}
      />
    </div>
  );
}
