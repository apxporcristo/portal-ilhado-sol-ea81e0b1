import { useState, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase-external';
import { useNavigate } from 'react-router-dom';
import { Ticket, Package, PackageCheck, AlertCircle, Shield, LogOut, Printer, Database, DollarSign, Plus, Clock, List, User, LogIn, CreditCard, ClipboardList, Settings, ArrowLeft, Scale, FileText } from 'lucide-react';
import { useVouchers } from '@/hooks/useVouchers';
import { usePrinterContext } from '@/contexts/PrinterContext';
import { useImpressoras, Impressora } from '@/hooks/useImpressoras';
import { useVoucherCart } from '@/hooks/useVoucherCart';
import { useAndroidBridge } from '@/hooks/useAndroidBridge';
import { usePrintJobs } from '@/hooks/usePrintJobs';
import { printVoucher } from '@/lib/voucher-utils';
import { printVouchersBatch } from '@/lib/print-browser';
import { getNetworkName, getWifiQrString } from '@/hooks/useNetworkName';
import { FileUpload } from '@/components/FileUpload';
import { StatsCard } from '@/components/StatsCard';
import { StatsDetailDialog } from '@/components/StatsDetailDialog';
import { VoucherReport } from '@/components/VoucherReport';
import { AdminSettings } from '@/components/AdminSettings';
import { SupabaseSettings } from '@/components/SupabaseSettings';
import { PrinterSettings } from '@/components/PrinterSettings';
import { PackageSettings } from '@/components/PackageSettings';
import { PrinterSelectDialog, AvailablePrinter } from '@/components/PrinterSelectDialog';
import { VoucherCart } from '@/components/VoucherCart';
import { UserPermissionsManager } from '@/components/UserPermissionsManager';
import { FormasPagamentoSettings } from '@/components/FormasPagamentoSettings';
import { PermissionGate } from '@/components/PermissionGate';
import { useOptionalUserSession } from '@/contexts/UserSessionContext';
import { useFichasConsumo } from '@/hooks/useFichasConsumo';
import { useComandas } from '@/hooks/useComandas';
import { AuditoriaComandas } from '@/components/AuditoriaComandas';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useBalanca } from '@/hooks/useBalanca';


const timeColors: Record<string, string> = {
  '1 Hora': 'bg-time-1h hover:bg-time-1h/90',
  '2 Horas': 'bg-time-2h hover:bg-time-2h/90',
  '3 Horas': 'bg-time-3h hover:bg-time-3h/90',
  '4 Horas': 'bg-time-4h hover:bg-time-4h/90',
  '5 Horas': 'bg-time-5h hover:bg-time-5h/90',
  '6 Horas': 'bg-time-6h hover:bg-time-6h/90',
};

const Index = () => {
  const {
    stats, loading, processing,
    importVouchers, useVouchersBatch, getFreVouchersBatch,
    markVouchersPreReservado, getUsedVouchersByDateRange, refetch,
  } = useVouchers();

  const [isAdmin, setIsAdmin] = useState(false);
  const { createVoucherData } = usePrinterContext();
  const { getVoucherPrinter, voucherConfig } = useImpressoras();
  const cart = useVoucherCart();
  const fichasConsumo = useFichasConsumo();
  const { comandasAbertas } = useComandas();
  const navigate = useNavigate();
  const androidBridge = useAndroidBridge();
  const { createPrintJob, createPrintJobFromBinary } = usePrintJobs();
  const { impressoras } = useImpressoras();
  const impressorasAtivas = impressoras.filter(p => p.ativa);
  const [showPrinterSelect, setShowPrinterSelect] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [statsDialog, setStatsDialog] = useState<{ open: boolean; type: 'total' | 'livres' | 'usados' | 'reservados'; title: string }>({ open: false, type: 'total', title: '' });
  const balanca = useBalanca();
  const userSession = useOptionalUserSession();
  const userAccess = userSession?.access;
  const isLoggedIn = !!userSession?.user;
  const canBeAdmin = userAccess?.is_admin === true;

  // Load visibility settings from app_settings as fallback
  const [showVoucher, setShowVoucher] = useState(true);
  const [showFichasConsumo, setShowFichasConsumo] = useState(true);

  useEffect(() => {
    getSupabaseClient().then(client => {
      client.from('app_settings').select('key, value').in('key', ['visualizar_voucher', 'visualizar_fichas_consumo']).then(({ data }) => {
        if (data) {
          data.forEach(row => {
            if (row.key === 'visualizar_voucher') setShowVoucher(row.value !== 'false');
            if (row.key === 'visualizar_fichas_consumo') setShowFichasConsumo(row.value !== 'false');
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    if (isAdmin) refetch();
  }, [isAdmin, refetch]);

  const executeBatchPrint = useCallback(async (printer: Impressora) => {
    setBatchPrinting(true);
    try {
      const voucherItems = cart.items;
      const selectedVouchers = voucherItems.length > 0 ? getFreVouchersBatch(voucherItems) : [];
      if (selectedVouchers.length === 0) { setBatchPrinting(false); return; }

      console.log('[Index Print] Impressora selecionada:', printer.nome, 'id:', printer.id);

      for (const v of selectedVouchers) {
        const escposData = await createVoucherData(v.voucher_id, v.tempo_validade);
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
    const { printer: voucherPrinter, error: voucherError } = getVoucherPrinter();
    
    if (voucherPrinter) {
      await executeBatchPrint(voucherPrinter);
      return;
    }

    // Fallback: use default or first active printer
    const defaultPrinter = impressorasAtivas.find(p => p.padrao) || impressorasAtivas[0];
    if (defaultPrinter) {
      await executeBatchPrint(defaultPrinter);
      return;
    }

    if (voucherError) {
      toast({ title: 'Impressora não configurada', description: voucherError, variant: 'destructive' });
    } else {
      toast({ title: 'Nenhuma impressora encontrada', description: 'Cadastre uma impressora nas configurações.', variant: 'destructive' });
    }
    setShowPrinterSelect(true);
  }, [getVoucherPrinter, executeBatchPrint, impressorasAtivas]);

  const handlePrinterSelected = useCallback(async (printer: Impressora) => {
    setShowPrinterSelect(false);
    await executeBatchPrint(printer);
  }, [executeBatchPrint]);

  const temposComVouchersLivres = stats.temposDisponiveis.filter(
    tempo => (stats.livresPorTempo[tempo] || 0) > 0
  );

  const canSeeVoucher = isLoggedIn ? (userAccess?.acesso_voucher ?? false) : showVoucher;
  const canSeeFichas = isLoggedIn ? (userAccess?.acesso_ficha_consumo ?? false) : showFichasConsumo;
  const canSeeFichasAdmin = isLoggedIn ? (userAccess?.acesso_cadastrar_produto ?? false) : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <Ticket className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-foreground">Sistema Voucher</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Gestão e impressão de vouchers de acesso</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isLoggedIn && (
                <Badge variant="outline" className="hidden sm:flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {userAccess?.nome || userSession?.user?.email}
                </Badge>
              )}
              
              {canSeeFichasAdmin && !isAdmin && (
                <Button variant="outline" size="icon" onClick={() => navigate('/fichas-admin')} title="Cadastro de ficha">
                  <ClipboardList className="h-4 w-4" />
                </Button>
              )}
              {canBeAdmin && !isAdmin && (
                <Button variant="outline" size="icon" onClick={() => setIsAdmin(true)} title="Configurações">
                  <Settings className="h-4 w-4" />
                </Button>
              )}

              {isLoggedIn ? (
                isAdmin ? (
                  <Button variant="outline" size="sm" onClick={() => setIsAdmin(false)}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Voltar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={async () => {
                    await userSession?.signOut();
                    navigate('/login');
                  }}>
                    <LogOut className="mr-1 h-4 w-4" />
                    Sair
                  </Button>
                )
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                  <LogIn className="mr-1 h-4 w-4" />
                  Entrar
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {isAdmin ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="cursor-pointer" onClick={() => setStatsDialog({ open: true, type: 'total', title: 'Total de Vouchers' })}>
                <StatsCard title="Total de Vouchers" value={stats.totalLivres + stats.totalReservados + stats.totalUsados} description="Vouchers cadastrados no sistema" icon={Ticket} variant="primary" />
              </div>
              <div className="cursor-pointer" onClick={() => setStatsDialog({ open: true, type: 'livres', title: 'Vouchers Livres' })}>
                <StatsCard title="Vouchers Livres" value={stats.totalLivres} description="Disponíveis para uso" icon={Package} variant="success" />
              </div>
              <div className="cursor-pointer" onClick={() => setStatsDialog({ open: true, type: 'reservados', title: 'Vouchers Reservados' })}>
                <StatsCard title="Vouchers Reservados" value={stats.totalReservados} description="Pré-reservados para impressão" icon={Clock} variant="default" />
              </div>
              <div className="cursor-pointer" onClick={() => setStatsDialog({ open: true, type: 'usados', title: 'Vouchers Usados' })}>
                <StatsCard title="Vouchers Usados" value={stats.totalUsados} description="Já foram impressos" icon={PackageCheck} variant="warning" />
              </div>
            </div>

            <Tabs defaultValue="import" className="w-full">
              <TabsList className="flex w-full overflow-x-auto max-w-6xl">
                <TabsTrigger value="import">Importar</TabsTrigger>
                <TabsTrigger value="report">Relatórios</TabsTrigger>
                <TabsTrigger value="packages" className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Pacotes
                </TabsTrigger>
                <TabsTrigger value="printer" className="flex items-center gap-1">
                  <Printer className="h-3 w-3" />
                  Impressora
                </TabsTrigger>
                <TabsTrigger value="payment" className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Pagamento
                </TabsTrigger>
                <TabsTrigger value="supabase" className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Supabase
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Usuários
                </TabsTrigger>
                <TabsTrigger value="settings">Configurações</TabsTrigger>
                <TabsTrigger value="auditoria" className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Auditoria
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="import" className="mt-6">
                <FileUpload onImport={importVouchers} processing={processing} />
              </TabsContent>
              <TabsContent value="report" className="mt-6">
                <VoucherReport stats={stats} getUsedVouchersByDateRange={getUsedVouchersByDateRange} />
              </TabsContent>
              <TabsContent value="packages" className="mt-6">
                <PackageSettings />
              </TabsContent>
              <TabsContent value="printer" className="mt-6">
                <PrinterSettings />
              </TabsContent>
              <TabsContent value="payment" className="mt-6">
                <FormasPagamentoSettings />
              </TabsContent>
              <TabsContent value="supabase" className="mt-6">
                <SupabaseSettings />
              </TabsContent>
              <TabsContent value="users" className="mt-6">
                <UserPermissionsManager />
              </TabsContent>
              <TabsContent value="settings" className="mt-6">
                <AdminSettings />
              </TabsContent>
              <TabsContent value="auditoria" className="mt-6">
                <AuditoriaComandas />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 px-2">
            <Alert variant="default" className="border max-w-md w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                {androidBridge.isAvailable()
                  ? 'Modo Aplicativo Android detectado'
                  : 'Modo Navegador - Impressão via navegador ativa'}
              </AlertDescription>
            </Alert>

            <div className="w-full max-w-md space-y-4">
              {/* Voucher e Fichas lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                {canSeeVoucher && (
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary"
                    onClick={() => navigate('/vouchers')}
                  >
                    <CardContent className="flex flex-col items-center justify-center gap-3 p-6">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <Ticket className="h-8 w-8 text-primary" />
                      </div>
                      <span className="text-base font-semibold text-foreground text-center">Voucher</span>
                    </CardContent>
                  </Card>
                )}
                {canSeeFichas && (
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary"
                    onClick={() => navigate('/fichas')}
                  >
                    <CardContent className="flex flex-col items-center justify-center gap-3 p-6">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <List className="h-8 w-8 text-primary" />
                      </div>
                      <span className="text-base font-semibold text-foreground text-center">Fichas</span>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Comandas abaixo, largura total */}
              {canSeeFichas && (
                <Card
                  className="cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-primary"
                  onClick={() => navigate('/comandas')}
                >
                  <CardContent className="flex items-center justify-between gap-3 p-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <ClipboardList className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <span className="text-base font-semibold text-foreground">Comandas</span>
                        {comandasAbertas.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            {comandasAbertas.length} comanda{comandasAbertas.length > 1 ? 's' : ''} aberta{comandasAbertas.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {comandasAbertas.length > 0 && (
                      <Badge variant="default" className="text-sm px-3 py-1">
                        {comandasAbertas.length}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Serve Service removido da tela inicial - agora está dentro de Fichas */}

            </div>
          </div>
        )}
      </main>

      <footer className="border-t bg-card mt-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <p className="text-center text-sm text-muted-foreground">
            Sistema Voucher © {new Date().getFullYear()} - Gestão de Vouchers de Acesso
          </p>
        </div>
      </footer>

      <PrinterSelectDialog open={showPrinterSelect} onOpenChange={setShowPrinterSelect} printers={availablePrinters} onSelect={handlePrinterSelected} />
      <StatsDetailDialog open={statsDialog.open} onOpenChange={(open) => setStatsDialog(prev => ({ ...prev, open }))} title={statsDialog.title} type={statsDialog.type} stats={stats} />
      
    </div>
  );
};

export default Index;
