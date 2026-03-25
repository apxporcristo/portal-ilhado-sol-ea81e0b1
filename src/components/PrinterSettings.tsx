import { useState, useEffect, useCallback } from 'react';
import {
  Printer, Wifi, Bluetooth, Monitor, Plus, Pencil, Trash2, Star, Power,
  Loader2, Smartphone, Search, Settings, CheckCircle, XCircle, Link2, PrinterCheck, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useImpressoras, Impressora, VoucherPrintTarget } from '@/hooks/useImpressoras';
import { usePrinterContext } from '@/contexts/PrinterContext';
import { useAndroidBridge, isAndroidApp } from '@/hooks/useAndroidBridge';
import { PrintLayoutSettings } from '@/components/PrintLayoutSettings';
import { FichaLayoutSettings } from '@/components/FichaLayoutSettings';
import { usePrintJobs, getLocalPrintServerUrl, setLocalPrintServerUrl } from '@/hooks/usePrintJobs';

interface PrinterFormData {
  nome: string;
  tipo: 'rede' | 'bluetooth';
  ip: string;
  porta: string;
  bluetooth_nome: string;
  bluetooth_mac: string;
  descricao: string;
  ativa: boolean;
  padrao: boolean;
}

const emptyForm: PrinterFormData = {
  nome: '', tipo: 'rede', ip: '', porta: '9100',
  bluetooth_nome: '', bluetooth_mac: '', descricao: '',
  ativa: true, padrao: false,
};

export function PrinterSettings() {
  const {
    impressoras, loading, voucherConfig,
    createImpressora, updateImpressora, deleteImpressora,
    setAsDefault, toggleAtiva, getBluetoothPrinters, saveVoucherConfig,
  } = useImpressoras();

  const { config, status, bluetoothDevices, updateConfig, saveConfig, scanBluetoothDevices, connectBluetooth, testConnection } = usePrinterContext();
  const androidBridge = useAndroidBridge();
  const { jobs, loading: jobsLoading, fetchJobs, createPrintJob, printDirect } = usePrintJobs();

  const [activeTab, setActiveTab] = useState('impressoras');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PrinterFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [printServerUrl, setPrintServerUrl] = useState(getLocalPrintServerUrl());

  const buildTestContent = (imp: Impressora) => [
    '\x1B\x40', '\x1B\x61\x01', '\x1B\x45\x01',
    'TESTE DE IMPRESSAO\n', '\x1B\x45\x00',
    '================================\n',
    `Impressora: ${imp.nome}\n`,
    `IP: ${imp.ip}:${imp.porta || 9100}\n`,
    `Data: ${new Date().toLocaleString('pt-BR')}\n`,
    '================================\n',
    'Conexao OK!\n\n\n', '\x1D\x56\x00',
  ].join('');

  /** Testa via Print Server local (direto) */
  const testDirectPrint = useCallback(async (imp: Impressora) => {
    if (imp.tipo !== 'rede' || !imp.ip) return;
    setTestingPrinterId(imp.id);
    try {
      await printDirect(imp.ip, imp.porta || 9100, buildTestContent(imp));
    } finally {
      setTestingPrinterId(null);
    }
  }, [printDirect]);

  /** Envia teste para a fila do Supabase */
  const sendTestToQueue = useCallback(async (imp: Impressora) => {
    if (imp.tipo !== 'rede' || !imp.ip) return;
    setTestingPrinterId(imp.id);
    try {
      await createPrintJob(imp.id, buildTestContent(imp), 'escpos');
    } finally {
      setTestingPrinterId(null);
    }
  }, [createPrintJob]);

  // Voucher config local state
  const [localTarget, setLocalTarget] = useState<VoucherPrintTarget>(voucherConfig.voucher_print_target);
  const [localBtId, setLocalBtId] = useState<string>(voucherConfig.voucher_bluetooth_printer_id || '');

  useEffect(() => {
    setLocalTarget(voucherConfig.voucher_print_target);
    setLocalBtId(voucherConfig.voucher_bluetooth_printer_id || '');
  }, [voucherConfig]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (imp: Impressora) => {
    setEditingId(imp.id);
    setForm({
      nome: imp.nome,
      tipo: imp.tipo,
      ip: imp.ip || '',
      porta: imp.porta || '9100',
      bluetooth_nome: imp.bluetooth_nome || '',
      bluetooth_mac: imp.bluetooth_mac || '',
      descricao: imp.descricao || '',
      ativa: imp.ativa,
      padrao: imp.padrao,
    });
    setFormOpen(true);
  };

  const handleSaveForm = async () => {
    const data = {
      nome: form.nome,
      tipo: form.tipo,
      ip: form.tipo === 'rede' ? form.ip || null : null,
      porta: form.tipo === 'rede' ? form.porta || '9100' : null,
      bluetooth_nome: form.tipo === 'bluetooth' ? form.bluetooth_nome || null : null,
      bluetooth_mac: form.tipo === 'bluetooth' ? form.bluetooth_mac || null : null,
      descricao: form.descricao || null,
      ativa: form.ativa,
      padrao: form.padrao,
    };
    let ok: boolean;
    if (editingId) {
      ok = await updateImpressora(editingId, data);
    } else {
      ok = await createImpressora(data as any);
    }
    if (ok) setFormOpen(false);
  };

  const handleSaveVoucherConfig = async () => {
    await saveVoucherConfig({
      voucher_print_target: localTarget,
      voucher_bluetooth_printer_id: localTarget === 'bluetooth_printer' ? localBtId || null : null,
    });
  };

  const btPrinters = getBluetoothPrinters();

  const isBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const [bluetoothAvailability, setBluetoothAvailability] = useState<'checking' | 'available' | 'disabled' | 'unsupported'>('checking');

  useEffect(() => {
    if (!isBluetoothSupported) { setBluetoothAvailability('unsupported'); return; }
    navigator.bluetooth?.getAvailability?.()
      .then(available => setBluetoothAvailability(available ? 'available' : 'disabled'))
      .catch(() => setBluetoothAvailability('available'));
  }, [isBluetoothSupported]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Configuração de Impressoras
        </CardTitle>
        <CardDescription>
          Cadastre impressoras e configure o destino de impressão dos vouchers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="impressoras" className="flex items-center gap-1 text-xs">
              <Printer className="h-4 w-4" />
              Impressoras
            </TabsTrigger>
            <TabsTrigger value="fila" className="flex items-center gap-1 text-xs">
              <List className="h-4 w-4" />
              Fila
            </TabsTrigger>
            <TabsTrigger value="voucher-config" className="flex items-center gap-1 text-xs">
              <Settings className="h-4 w-4" />
              Destino Voucher
            </TabsTrigger>
            <TabsTrigger value="layout-voucher" className="flex items-center gap-1 text-xs">
              <Monitor className="h-4 w-4" />
              Layout Voucher
            </TabsTrigger>
            <TabsTrigger value="layout-ficha" className="flex items-center gap-1 text-xs">
              <Monitor className="h-4 w-4" />
              Layout Ficha
            </TabsTrigger>
          </TabsList>

          {/* === IMPRESSORAS LIST === */}
          <TabsContent value="impressoras" className="space-y-4 mt-4">
            {/* Android SmartPrint Section */}
            {isAndroidApp() && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <Label className="font-semibold">Android (SmartPrint)</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => androidBridge.autoDetectPrinter()}>
                    <Search className="mr-2 h-4 w-4" /> Detectar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => androidBridge.testPrint()}>
                    <Printer className="mr-2 h-4 w-4" /> Teste
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => androidBridge.openPrinterConfig()}>
                    <Settings className="mr-2 h-4 w-4" /> Configurar
                  </Button>
                </div>
              </div>
            )}

            {/* Print Server URL config */}
            <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" />
                <Label className="font-semibold">Print Server Local</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                IP do PC que roda o print_server.py na sua rede (ex: http://192.168.1.10:8787)
              </p>
              <div className="flex gap-2">
                <Input
                  value={printServerUrl}
                  onChange={(e) => setPrintServerUrl(e.target.value)}
                  placeholder="http://192.168.1.10:8787"
                  className="flex-1"
                />
                <Button size="sm" onClick={() => {
                  setLocalPrintServerUrl(printServerUrl);
                  toast({ title: '✅ Print Server salvo' });
                }}>
                  Salvar
                </Button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Lista de Impressoras</h3>
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" /> Nova Impressora
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : impressoras.length === 0 ? (
              <Alert><AlertDescription>Nenhuma impressora cadastrada. Clique em "Nova Impressora" para adicionar.</AlertDescription></Alert>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead className="text-center">Ativa</TableHead>
                      <TableHead className="text-center">Padrão</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impressoras.map((imp) => (
                      <TableRow key={imp.id} className={!imp.ativa ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{imp.nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {imp.tipo === 'rede' ? <><Wifi className="h-3 w-3 mr-1" />Rede</> : <><Bluetooth className="h-3 w-3 mr-1" />BT</>}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {imp.tipo === 'rede' ? `${imp.ip || '-'}:${imp.porta || '9100'}` : imp.bluetooth_nome || imp.bluetooth_mac || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={imp.ativa} onCheckedChange={(v) => toggleAtiva(imp.id, v)} />
                        </TableCell>
                        <TableCell className="text-center">
                          {imp.padrao ? <Star className="h-4 w-4 text-primary mx-auto fill-primary" /> : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAsDefault(imp.id)}>
                              <Star className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {imp.tipo === 'rede' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-green-600"
                                  onClick={() => testDirectPrint(imp)}
                                  disabled={testingPrinterId === imp.id}
                                  title="Imprimir direto (Print Server local)"
                                >
                                  {testingPrinterId === imp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary"
                                  onClick={() => sendTestToQueue(imp)}
                                  disabled={testingPrinterId === imp.id}
                                  title="Enviar para fila (Supabase)"
                                >
                                  <List className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(imp)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(imp.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Legacy BT scan for quick pairing */}
            {bluetoothAvailability === 'available' && (
              <div className="pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => scanBluetoothDevices()}>
                  <Search className="mr-2 h-4 w-4" /> Buscar Bluetooth (pareamento)
                </Button>
              </div>
            )}
          </TabsContent>

          {/* === VOUCHER CONFIG === */}
          <TabsContent value="voucher-config" className="space-y-6 mt-4">
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Configuração de Impressão de Voucher</h3>
              <p className="text-sm text-muted-foreground">Defina para onde a impressão dos vouchers será enviada.</p>

              <div className="space-y-2">
                <Label>Destino da impressão do voucher</Label>
                <Select value={localTarget} onValueChange={(v) => setLocalTarget(v as VoucherPrintTarget)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default_printer">Impressora padrão</SelectItem>
                    <SelectItem value="bluetooth_printer">Impressora Bluetooth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {localTarget === 'bluetooth_printer' && (
                <div className="space-y-2">
                  <Label>Impressora Bluetooth dos vouchers</Label>
                  {btPrinters.length === 0 ? (
                    <Alert variant="destructive">
                      <AlertDescription>Nenhuma impressora Bluetooth ativa cadastrada. Cadastre uma na aba "Impressoras".</AlertDescription>
                    </Alert>
                  ) : (
                    <Select value={localBtId} onValueChange={setLocalBtId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {btPrinters.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} {p.bluetooth_nome ? `(${p.bluetooth_nome})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <Button onClick={handleSaveVoucherConfig}>Salvar Configuração</Button>
            </div>
          </TabsContent>

          {/* === FILA DE IMPRESSÃO === */}
          <TabsContent value="fila" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Fila de Impressão</h3>
              <Button size="sm" variant="outline" onClick={fetchJobs} disabled={jobsLoading}>
                {jobsLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
                Atualizar
              </Button>
            </div>
            {jobs.length === 0 ? (
              <Alert><AlertDescription>Nenhuma tarefa na fila.</AlertDescription></Alert>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Impressora</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => {
                      const imp = impressoras.find(i => i.id === job.printer_id);
                      return (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{imp?.nome || job.printer_id.slice(0, 8)}</TableCell>
                          <TableCell><Badge variant="outline">{job.formato}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={
                              job.status === 'concluido' ? 'default' :
                              job.status === 'erro' ? 'destructive' :
                              job.status === 'imprimindo' ? 'secondary' : 'outline'
                            }>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(job.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-sm text-destructive">{job.erro || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Layout tabs */}
          <TabsContent value="layout-voucher" className="mt-4"><PrintLayoutSettings /></TabsContent>
          <TabsContent value="layout-ficha" className="mt-4"><FichaLayoutSettings /></TabsContent>
        </Tabs>

        {/* Dicas */}
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Dicas</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Impressoras térmicas 58mm são recomendadas para vouchers</li>
            <li>• Apenas uma impressora pode ser padrão por vez</li>
            <li>• Configure o destino Bluetooth para enviar vouchers direto para a impressora BT</li>
          </ul>
        </div>
      </CardContent>

      {/* === FORM DIALOG === */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Impressora' : 'Nova Impressora'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Impressora Caixa 1" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v as 'rede' | 'bluetooth' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rede">Rede (TCP/IP)</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.tipo === 'rede' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IP</Label>
                  <Input value={form.ip} onChange={(e) => setForm(f => ({ ...f, ip: e.target.value }))} placeholder="192.168.1.100" />
                </div>
                <div className="space-y-2">
                  <Label>Porta</Label>
                  <Input value={form.porta} onChange={(e) => setForm(f => ({ ...f, porta: e.target.value }))} placeholder="9100" />
                </div>
              </div>
            )}

            {form.tipo === 'bluetooth' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    try {
                      if (!navigator.bluetooth) {
                        toast({ title: 'Bluetooth não suportado', description: 'Seu navegador não suporta Web Bluetooth.', variant: 'destructive' });
                        return;
                      }
                      const device = await navigator.bluetooth.requestDevice({
                        acceptAllDevices: true,
                      });
                      if (device) {
                        setForm(f => ({
                          ...f,
                          bluetooth_nome: device.name || 'Dispositivo BT',
                          nome: f.nome || device.name || 'Impressora Bluetooth',
                        }));
                        toast({ title: 'Dispositivo selecionado', description: device.name || 'Dispositivo sem nome' });
                      }
                    } catch (err: any) {
                      if (err?.name !== 'NotFoundError') {
                        toast({ title: 'Erro', description: err?.message || 'Não foi possível buscar dispositivos.', variant: 'destructive' });
                      }
                    }
                  }}
                >
                  <Search className="mr-2 h-4 w-4" /> Pesquisar Dispositivos Bluetooth
                </Button>
                <div className="space-y-2">
                  <Label>Nome Bluetooth</Label>
                  <Input value={form.bluetooth_nome} onChange={(e) => setForm(f => ({ ...f, bluetooth_nome: e.target.value }))} placeholder="Ex: InnerPrinter" />
                </div>
                <div className="space-y-2">
                  <Label>MAC (opcional)</Label>
                  <Input value={form.bluetooth_mac} onChange={(e) => setForm(f => ({ ...f, bluetooth_mac: e.target.value }))} placeholder="00:11:22:33:44:55" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Balcão principal" />
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={form.ativa} onCheckedChange={(v) => setForm(f => ({ ...f, ativa: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Definir como padrão</Label>
              <Switch checked={form.padrao} onCheckedChange={(v) => setForm(f => ({ ...f, padrao: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveForm} disabled={!form.nome || (form.tipo === 'rede' && !form.ip)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir impressora"
        description="Tem certeza que deseja excluir esta impressora?"
        onConfirm={() => { if (deleteConfirm) { deleteImpressora(deleteConfirm); setDeleteConfirm(null); } }}
      />
    </Card>
  );
}
