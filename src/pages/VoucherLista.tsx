import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ticket, Package, PackageCheck, AlertCircle, Clock, Plus, Printer, Eye } from 'lucide-react';
import { useVouchers } from '@/hooks/useVouchers';
import { usePrinterContext } from '@/contexts/PrinterContext';
import { useImpressoras } from '@/hooks/useImpressoras';
import { useVoucherCart } from '@/hooks/useVoucherCart';
import { useAndroidBridge } from '@/hooks/useAndroidBridge';
import { printVouchersBatch } from '@/lib/print-browser';
import { getNetworkName, getWifiQrString } from '@/hooks/useNetworkName';
import { PrinterSelectDialog, AvailablePrinter } from '@/components/PrinterSelectDialog';
import { VoucherCart } from '@/components/VoucherCart';
import { VoucherViewDialog } from '@/components/VoucherViewDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useOptionalUserSession } from '@/contexts/UserSessionContext';

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
    stats, loading, processing,
    getFreVouchersBatch, markVouchersPreReservado,
  } = useVouchers();

  const { config, printData, createVoucherData, isBluetoothConnected, reconnectBluetooth, silentReconnectBluetooth, scanBluetoothDevices, connectBluetooth } = usePrinterContext();
  const { getVoucherPrinter } = useImpressoras();
  const cart = useVoucherCart();
  const androidBridge = useAndroidBridge();
  const [showPrinterSelect, setShowPrinterSelect] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<AvailablePrinter[]>([]);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [viewVouchers, setViewVouchers] = useState<{ voucher_id: string; tempo_validade: string }[]>([]);

  const getAvailablePrinters = useCallback((): AvailablePrinter[] => {
    const printers: AvailablePrinter[] = [];
    if (androidBridge.isAvailable()) {
      printers.push({ type: 'network' as const, name: 'Android (SmartPrint)' });
    }
    if (config.bluetoothDeviceName) {
      printers.push({ type: 'bluetooth', name: config.bluetoothDeviceName });
    }
    if (config.networkIp) {
      printers.push({ type: 'network', name: `${config.networkIp}:${config.networkPort || '9100'}` });
    }
    printers.push({ type: 'browser' as any, name: 'Navegador (Browser)' });
    return printers;
  }, [config, androidBridge]);

  const handleAddToCart = useCallback((tempo: string) => {
    const inCart = cart.items.find(i => i.tempo === tempo)?.quantity || 0;
    const available = stats.livresPorTempo[tempo] || 0;
    if (inCart >= available) {
      toast({ title: 'Limite atingido', description: `Todos os ${available} voucher(s) de ${tempo} já estão no carrinho.` });
      return;
    }
    cart.addItem(tempo);
  }, [cart, stats.livresPorTempo]);

  const executeBatchPrint = useCallback(async (printer?: AvailablePrinter) => {
    setBatchPrinting(true);
    try {
      const voucherItems = cart.items;
      const selectedVouchers = voucherItems.length > 0 ? getFreVouchersBatch(voucherItems) : [];
      const voucherData = selectedVouchers.map(v => ({ voucher_id: v.voucher_id, tempo_validade: v.tempo_validade }));
      let printSuccess = false;
      const hasVouchers = voucherData.length > 0;
      if (!hasVouchers) { setBatchPrinting(false); return; }

      if (printer?.name === 'Android (SmartPrint)') {
        const networkName = getNetworkName();
        const wifiQrData = getWifiQrString();
        const now = new Date();
        const currentDate = now.toLocaleDateString('pt-BR');
        const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        for (const v of voucherData) {
          const texto = "VOUCHER DE ACESSO\n\n" + `Coloque no modo avião antes de acessar a rede "${networkName}"\n\n` + `Voucher: ${v.voucher_id}\n` + `Tempo de conexão: ${v.tempo_validade}\n` + `Data: ${currentDate} ${currentTime}`;
          if (window.AndroidBridge?.smartPrintVoucher) {
            window.AndroidBridge.smartPrintVoucher(texto, wifiQrData);
          } else {
            window.location.href = "voucherilha://print?text=" + encodeURIComponent(texto) + "&qr=" + encodeURIComponent(wifiQrData);
          }
        }
        printSuccess = true;
      } else if (printer?.type === 'network') {
        try {
          const parts = printer.name.split(':');
          const printerIp = parts[0];
          const printerPort = parts[1] || '9100';
          
          for (const v of voucherData) {
            const escposData = await createVoucherData(v.voucher_id, v.tempo_validade);
            const response = await fetch('http://127.0.0.1:8787/print', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ip: printerIp, port: parseInt(printerPort), data: Array.from(escposData) }),
            });
            if (!response.ok) {
              const result = await response.json().catch(() => ({}));
              throw new Error(result.error || 'Erro ao imprimir');
            }
          }
          printSuccess = true;
        } catch (err: any) {
          console.error('Erro na impressão de rede:', err);
          const isOffline = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError';
          toast({ 
            title: isOffline ? 'App local não encontrado' : 'Erro na impressão', 
            description: isOffline ? 'O aplicativo de impressão local (porta 8787) não está respondendo. Verifique se está em execução.' : 'Não foi possível imprimir. Vouchers NÃO foram marcados.', 
            variant: 'destructive' 
          });
        }
      } else if (printer?.type === 'bluetooth_local') {
        try {
          for (const v of voucherData) {
            const escposData = await createVoucherData(v.voucher_id, v.tempo_validade);
            const response = await fetch('http://127.0.0.1:8787/print', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bluetoothAddress: printer.name, data: Array.from(escposData) }),
            });
            if (!response.ok) {
              const result = await response.json().catch(() => ({}));
              throw new Error(result.error || 'Erro ao imprimir via Bluetooth');
            }
          }
          printSuccess = true;
        } catch (err: any) {
          console.error('Erro na impressão Bluetooth local:', err);
          const isOffline = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError';
          toast({ 
            title: isOffline ? 'App local não encontrado' : 'Erro na impressão Bluetooth', 
            description: isOffline ? 'O aplicativo de impressão local (porta 8787) não está respondendo. Verifique se está em execução.' : 'Falha ao imprimir via Bluetooth.', 
            variant: 'destructive' 
          });
        }
      } else if (printer?.type === 'bluetooth') {
        let activeChar: any = null;
        if (!isBluetoothConnected()) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            toast({ title: `Reconectando... (${attempt}/3)`, description: `Tentando reconectar à impressora ${config.bluetoothDeviceName || ''}` });
            activeChar = await reconnectBluetooth();
            if (activeChar) break;
            if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
          }
          if (!activeChar) {
            toast({ title: 'Buscando impressora...', description: 'Selecione a impressora Bluetooth na janela do navegador.' });
            try {
              const devices = await scanBluetoothDevices();
              if (devices.length > 0) activeChar = await connectBluetooth(devices[0].device);
            } catch {}
            if (!activeChar) {
              toast({ title: 'Falha na conexão', description: 'Não foi possível conectar à impressora.', variant: 'destructive' });
              setBatchPrinting(false);
              return;
            }
          }
        }
        let allSuccess = true;
        for (const v of voucherData) {
          const data = await createVoucherData(v.voucher_id, v.tempo_validade);
          const success = await printData(data, activeChar || undefined);
          if (!success) { allSuccess = false; break; }
        }
        if (allSuccess) printSuccess = true;
        else toast({ title: 'Erro na impressão Bluetooth', description: 'Falha ao imprimir.', variant: 'destructive' });
      } else {
        try {
          if (hasVouchers) await printVouchersBatch(voucherData);
          printSuccess = true;
        } catch (err) {
          console.error('Erro na impressão pelo navegador:', err);
          toast({ title: 'Erro na impressão', description: 'Não foi possível imprimir pelo navegador.', variant: 'destructive' });
        }
      }

      if (printSuccess) {
        if (selectedVouchers.length > 0) await markVouchersPreReservado(selectedVouchers.map(v => v.voucher_id));
        toast({ title: 'Impressão concluída!', description: `${selectedVouchers.length} item(ns) impressos.` });
        cart.clearCart();
      }
    } catch (error) {
      console.error('Erro na impressão em lote:', error);
      toast({ title: 'Erro', description: 'Ocorreu um erro durante a impressão.', variant: 'destructive' });
    } finally {
      setBatchPrinting(false);
    }
  }, [cart, getFreVouchersBatch, markVouchersPreReservado, createVoucherData, printData, isBluetoothConnected, reconnectBluetooth, scanBluetoothDevices, connectBluetooth, androidBridge]);

  const handleBatchPrint = useCallback(async () => {
    const { printer: voucherPrinter, error: voucherError } = getVoucherPrinter();
    
    if (voucherPrinter) {
      if (voucherPrinter.tipo === 'bluetooth') {
        const btLocalPrinter: AvailablePrinter = { type: 'bluetooth_local', name: voucherPrinter.bluetooth_mac || voucherPrinter.bluetooth_nome || voucherPrinter.nome };
        await executeBatchPrint(btLocalPrinter);
        return;
      }
      if (voucherPrinter.tipo === 'rede') {
        const netPrinter: AvailablePrinter = { type: 'network', name: `${voucherPrinter.ip}:${voucherPrinter.porta || '9100'}` };
        await executeBatchPrint(netPrinter);
        return;
      }
    }

    if (voucherError) {
      toast({ title: 'Impressora não configurada', description: voucherError, variant: 'destructive' });
    }

    const printers = getAvailablePrinters();
    const networkPrinter = printers.find(p => p.type === 'network' && p.name !== 'Android (SmartPrint)');
    if (networkPrinter) { await executeBatchPrint(networkPrinter); return; }
    const androidPrinter = printers.find(p => p.name === 'Android (SmartPrint)');
    if (androidPrinter) { await executeBatchPrint(androidPrinter); return; }
    const btPrinter = printers.find(p => p.type === 'bluetooth');
    if (btPrinter) {
      if (isBluetoothConnected()) { await executeBatchPrint(btPrinter); return; }
      for (let attempt = 1; attempt <= 3; attempt++) {
        toast({ title: `Reconectando... (${attempt}/3)`, description: `Tentando conectar a ${btPrinter.name} automaticamente` });
        const char = await silentReconnectBluetooth();
        if (char) { await executeBatchPrint(btPrinter); return; }
        if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
      }
      toast({ title: 'Não foi possível reconectar', description: 'Selecione a impressora manualmente.', variant: 'destructive' });
      const char = await reconnectBluetooth();
      if (char) { await executeBatchPrint(btPrinter); return; }
    }
    toast({ title: 'Nenhuma impressora encontrada', description: 'Selecione ou conecte uma impressora.' });
    setAvailablePrinters(printers);
    setShowPrinterSelect(true);
  }, [getVoucherPrinter, getAvailablePrinters, executeBatchPrint, isBluetoothConnected, reconnectBluetooth, silentReconnectBluetooth, toast]);

  const handlePrinterSelected = useCallback(async (printer: AvailablePrinter) => {
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

      <PrinterSelectDialog open={showPrinterSelect} onOpenChange={setShowPrinterSelect} printers={availablePrinters} onSelect={handlePrinterSelected} />
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
