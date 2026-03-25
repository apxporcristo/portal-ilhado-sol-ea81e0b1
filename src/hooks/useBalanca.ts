import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase-external';
import { toast } from '@/hooks/use-toast';

export interface BalancaConfig {
  id?: string;
  tipo_conexao: 'bluetooth' | 'serial' | 'usb_serial';
  dispositivo_nome: string | null;
  dispositivo_id: string | null;
  porta_serial: string | null;
  baud_rate: number;
  valor_peso: number;
}

export type BalancaStatus = 'desconectada' | 'conectando' | 'conectada' | 'falha' | 'tentando';

const DEFAULT_CONFIG: BalancaConfig = {
  tipo_conexao: 'serial',
  dispositivo_nome: null,
  dispositivo_id: null,
  porta_serial: null,
  baud_rate: 9600,
  valor_peso: 0,
};

// Toledo Prix 3 protocol: STX (0x02) + weight digits + ETX (0x03)
function parseToledoWeight(data: string): number | null {
  const stxIdx = data.indexOf('\x02');
  const etxIdx = data.indexOf('\x03', stxIdx);
  if (stxIdx === -1 || etxIdx === -1) return null;
  const payload = data.substring(stxIdx + 1, etxIdx).trim();
  const match = payload.match(/(\d+\.?\d*)/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  return value > 100 ? value / 1000 : value;
}

function parseToledoWeightBytes(bytes: Uint8Array): number | null {
  const str = new TextDecoder().decode(bytes);
  return parseToledoWeight(str);
}

// Persistent BT state (module-level to survive re-renders)
let _btDevice: any = null;
let _btServer: any = null;
let _btCharacteristic: any = null;

export function useBalanca() {
  const [config, setConfig] = useState<BalancaConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BalancaStatus>('desconectada');
  const [tentativa, setTentativa] = useState(0);
  const [serialPort, setSerialPort] = useState<any>(null);
  const autoConnectAttempted = useRef(false);

  const connected = status === 'conectada';

  const fetchConfig = useCallback(async () => {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.from('balanca_config' as any).select('*').limit(1).maybeSingle();
      if (error) console.error('Erro ao buscar config balança:', error);
      if (data) {
        setConfig({
          id: (data as any).id,
          tipo_conexao: (data as any).tipo_conexao || 'serial',
          dispositivo_nome: (data as any).dispositivo_nome || null,
          dispositivo_id: (data as any).dispositivo_id || null,
          porta_serial: (data as any).porta_serial || null,
          baud_rate: (data as any).baud_rate || 9600,
          valor_peso: (data as any).valor_peso || 0,
        });
      }
    } catch (err) {
      console.error('Erro fetchConfig balança:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const saveConfig = useCallback(async (newConfig: BalancaConfig) => {
    try {
      const supabase = await getSupabaseClient();
      const payload = {
        tipo_conexao: newConfig.tipo_conexao,
        dispositivo_nome: newConfig.dispositivo_nome || null,
        dispositivo_id: newConfig.dispositivo_id || null,
        porta_serial: newConfig.porta_serial || null,
        baud_rate: newConfig.baud_rate,
        valor_peso: newConfig.valor_peso || 0,
      };

      if (newConfig.id) {
        const { error } = await supabase.from('balanca_config' as any)
          .update({ ...payload, updated_at: new Date().toISOString() } as any)
          .eq('id', newConfig.id);
        if (error) {
          console.error('Erro ao atualizar balança:', error);
          toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
          return;
        }
      } else {
        const { data, error } = await supabase.from('balanca_config' as any)
          .insert(payload as any)
          .select()
          .single();
        if (error) {
          console.error('Erro ao inserir balança:', error);
          toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
          return;
        }
        if (data) newConfig = { ...newConfig, id: (data as any).id };
      }
      setConfig(newConfig);
      toast({ title: 'Configuração da balança salva' });
    } catch (err) {
      console.error('Erro saveConfig balança:', err);
      toast({ title: 'Erro ao salvar', description: 'Falha inesperada ao salvar configuração.', variant: 'destructive' });
    }
  }, []);

  // ========== BLUETOOTH CONNECTION ==========
  // Web Bluetooth (BLE/GATT) does NOT work with classic serial scales (SPP/RFCOMM).
  // Scales like Toledo Prix 3 use Bluetooth Classic, which Chrome/Web Bluetooth cannot access.
  // All BT scale communication must go through the Android Bridge (APK auxiliar).

  const isBtConnected = useCallback((): boolean => {
    // In Android app, check via bridge
    if (window.IS_ANDROID_APP) {
      return window.AndroidBridge?.isScaleConnected?.() ?? false;
    }
    // In browser, BT scale is never connected (not supported)
    return false;
  }, []);

  // Try to reconnect via Android Bridge
  const reconnectSavedDevice = useCallback(async (): Promise<boolean> => {
    if (isBtConnected()) {
      setStatus('conectada');
      return true;
    }
    // Only works through Android Bridge
    if (window.IS_ANDROID_APP && window.AndroidBridge?.connectScale) {
      const address = config.dispositivo_id || '';
      if (!address) return false;
      console.log('[Balança] Tentando reconectar via AndroidBridge:', address);
      const ok = window.AndroidBridge.connectScale(address, config.baud_rate);
      setStatus(ok ? 'conectada' : 'falha');
      return ok;
    }
    return false;
  }, [isBtConnected, config.dispositivo_id, config.baud_rate]);

  // Auto-reconnect on mount if BT config exists
  useEffect(() => {
    if (!loading && config.tipo_conexao === 'bluetooth' && config.dispositivo_id && !autoConnectAttempted.current) {
      autoConnectAttempted.current = true;
      reconnectSavedDevice().then(ok => {
        if (ok) {
          console.log('Balança BT reconectada automaticamente');
        } else {
          console.log('Auto-reconexão BT falhou, aguardando ação manual');
        }
      });
    }
  }, [loading, config.tipo_conexao, config.dispositivo_id, reconnectSavedDevice]);

  // Reconnect with 3 retries, then fallback to new pairing
  const connectBluetoothWithRetries = useCallback(async (): Promise<boolean> => {
    // Already connected?
    if (isBtConnected()) {
      setStatus('conectada');
      return true;
    }

    // Try 3 reconnection attempts
    for (let attempt = 1; attempt <= 3; attempt++) {
      setStatus('tentando');
      setTentativa(attempt);
      const ok = await reconnectSavedDevice();
      if (ok) {
        setTentativa(0);
        return true;
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500));
    }

    setTentativa(0);
    setStatus('falha');
    return false;
  }, [isBtConnected, reconnectSavedDevice]);

  const listarDispositivosPareadosAndroid = useCallback((): Array<{ name: string; address: string }> => {
    try {
      const raw = window.AndroidBridge?.listPairedDevices?.();
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, []);


  const parearNovoDispositivo = useCallback(async (): Promise<boolean> => {
    if (window.IS_ANDROID_APP && window.AndroidBridge?.listPairedDevices) {
      // In Android app, list paired devices and let user pick
      const devices = listarDispositivosPareadosAndroid();
      if (devices.length === 0) {
        toast({ title: 'Nenhum dispositivo pareado', description: 'Pareie a balança nas configurações Bluetooth do Android primeiro.', variant: 'destructive' });
        return false;
      }
      // Connect to first device as default (user can change in settings)
      const first = devices[0];
      const ok = window.AndroidBridge.connectScale!(first.address, config.baud_rate);
      if (ok) {
        const newConfig: BalancaConfig = {
          ...config,
          dispositivo_nome: first.name,
          dispositivo_id: first.address,
        };
        await saveConfig(newConfig);
        setStatus('conectada');
        toast({ title: 'Balança conectada', description: `Conectado a: ${first.name}` });
        return true;
      }
      setStatus('falha');
      return false;
    }

    toast({
      title: 'Bluetooth Classic não suportado no navegador',
      description: 'Balanças seriais usam Bluetooth Classic (SPP), que não é suportado pelo Chrome. Use o app Android auxiliar.',
      variant: 'destructive',
    });
    return false;
  }, [config, saveConfig, listarDispositivosPareadosAndroid]);

  // List previously paired BT devices (only via Android Bridge)
  const listarDispositivosPareados = useCallback(async (): Promise<Array<{ id: string; name: string; device: any }>> => {
    if (window.IS_ANDROID_APP) {
      return listarDispositivosPareadosAndroid().map(d => ({
        id: d.address,
        name: d.name,
        device: d,
      }));
    }
    return [];
  }, [listarDispositivosPareadosAndroid]);

  // Connect to a specific device from the list (via Android Bridge)
  const conectarDispositivo = useCallback(async (device: any): Promise<boolean> => {
    if (window.IS_ANDROID_APP && window.AndroidBridge?.connectScale) {
      const address = device.address || device.id;
      const ok = window.AndroidBridge.connectScale(address, config.baud_rate);
      if (ok) {
        const newConfig: BalancaConfig = {
          ...config,
          dispositivo_nome: device.name || 'Balança BT',
          dispositivo_id: address,
        };
        await saveConfig(newConfig);
        setStatus('conectada');
        return true;
      }
      setStatus('falha');
    }
    return false;
  }, [config, saveConfig]);

  const lerPesoAndroid = useCallback((): number | null => {
    try {
      const bridge = window.AndroidBridge;
      if (!bridge || !bridge.readScale) return null;
      const raw = bridge.readScale();
      console.log('[Balança] AndroidBridge.readScale() retornou:', raw);
      if (!raw) return null;
      const parsed = parseToledoWeight(raw);
      if (parsed !== null) return parsed;
      const num = parseFloat(raw.replace(',', '.'));
      return isNaN(num) ? null : num;
    } catch {
      return null;
    }
  }, []);

  // Read weight via Android Bridge (Bluetooth Classic serial)
  const lerPesoBluetooth = useCallback(async (): Promise<number | null> => {
    return lerPesoAndroid();
  }, [lerPesoAndroid]);

  const lerPesoSerial = useCallback(async (): Promise<number | null> => {
    try {
      if (!('serial' in navigator)) return null;
      let port = serialPort;
      if (!port) {
        port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: config.baud_rate });
        setSerialPort(port);
        setStatus('conectada');
      }
      const writer = port.writable.getWriter();
      await writer.write(new Uint8Array([0x05])); // ENQ
      writer.releaseLock();

      const reader = port.readable.getReader();
      const timeout = setTimeout(() => reader.cancel(), 3000);
      try {
        const { value } = await reader.read();
        clearTimeout(timeout);
        reader.releaseLock();
        if (value) return parseToledoWeightBytes(value);
      } catch {
        clearTimeout(timeout);
        reader.releaseLock();
      }
      return null;
    } catch (err) {
      console.error('Erro serial:', err);
      return null;
    }
  }, [serialPort, config.baud_rate]);
  const conectarBalancaAndroid = useCallback((): boolean => {
    const bridge = window.AndroidBridge;
    if (!bridge?.connectScale) return false;
    const address = config.dispositivo_id || '';
    if (!address) {
      toast({ title: 'Dispositivo não configurado', description: 'Configure o endereço da balança em balanca_config.', variant: 'destructive' });
      return false;
    }
    console.log('[Balança] connectScale:', address, 'baud:', config.baud_rate);
    const ok = bridge.connectScale(address, config.baud_rate);
    setStatus(ok ? 'conectada' : 'falha');
    return ok;
  }, [config.dispositivo_id, config.baud_rate]);

  const desconectarBalancaAndroid = useCallback(() => {
    window.AndroidBridge?.disconnectScale?.();
    setStatus('desconectada');
  }, []);

  const isScaleConnectedAndroid = useCallback((): boolean => {
    return window.AndroidBridge?.isScaleConnected?.() ?? false;
  }, []);

  // (listarDispositivosPareadosAndroid moved above parearNovoDispositivo)

  // Main read function - prioritizes AndroidBridge, then persistent BT/serial
  const lerPeso = useCallback(async (retries = 3): Promise<number | null> => {
    // Always try Android Bridge first (works with auxiliary app)
    const pesoAndroid = lerPesoAndroid();
    if (pesoAndroid !== null && pesoAndroid > 0) return pesoAndroid;

    for (let attempt = 1; attempt <= retries; attempt++) {
      // Serial/USB
      if (config.tipo_conexao === 'serial' || config.tipo_conexao === 'usb_serial') {
        const peso = await lerPesoSerial();
        if (peso !== null && peso > 0) return peso;
      }

      // Bluetooth via Web Bluetooth (only in Android app context, skip in browser)
      if (config.tipo_conexao === 'bluetooth') {
        if (window.IS_ANDROID_APP) {
          // In Android app, try Web Bluetooth connection
          if (!isBtConnected()) {
            const reconnected = await reconnectSavedDevice();
            if (!reconnected) continue;
          }
          const pesoBt = await lerPesoBluetooth();
          if (pesoBt !== null && pesoBt > 0) return pesoBt;
        }
        // In browser, skip Web Bluetooth entirely - it won't work for scales
      }

      if (attempt < retries) await new Promise(r => setTimeout(r, 1000));
    }

    // All retries failed for BT
    if (config.tipo_conexao === 'bluetooth') {
      const isAndroidApp = !!window.IS_ANDROID_APP;
      if (isAndroidApp) {
        toast({ title: 'Balança não respondeu', description: 'Verifique se o app auxiliar está conectado à balança.' });
      } else {
        toast({
          title: 'Bluetooth indisponível no navegador',
          description: 'O Web Bluetooth não suporta este tipo de balança. Use o app Android auxiliar ou digite o peso manualmente.',
        });
      }
    }

    return null;
  }, [config.tipo_conexao, lerPesoSerial, lerPesoAndroid, lerPesoBluetooth, isBtConnected, reconnectSavedDevice]);

  const testarConexao = useCallback(async (): Promise<boolean> => {
    if (config.tipo_conexao === 'bluetooth') {
      const ok = await connectBluetoothWithRetries();
      if (!ok) {
        toast({ title: 'Falha na conexão', description: 'Não foi possível conectar à balança. Tente parear novamente.', variant: 'destructive' });
        return false;
      }
      // Try reading weight
      const peso = await lerPesoBluetooth();
      if (peso !== null) {
        toast({ title: 'Conexão OK', description: `Peso lido: ${peso.toFixed(3)} kg` });
        return true;
      }
      toast({ title: 'Conectada', description: 'Balança conectada, mas sem leitura de peso no momento.' });
      return true;
    }

    const peso = await lerPeso();
    if (peso !== null) {
      toast({ title: 'Conexão OK', description: `Peso lido: ${peso.toFixed(3)} kg` });
      setStatus('conectada');
      return true;
    }
    toast({ title: 'Falha na conexão', description: 'Não foi possível ler peso da balança.', variant: 'destructive' });
    setStatus('falha');
    return false;
  }, [config.tipo_conexao, connectBluetoothWithRetries, lerPesoBluetooth, lerPeso]);

  const buscarDispositivosSerial = useCallback(async (): Promise<string[]> => {
    try {
      if (!('serial' in navigator)) return [];
      const port = await (navigator as any).serial.requestPort();
      const info = port.getInfo();
      return [info?.usbProductId ? `USB Device ${info.usbProductId}` : 'Serial Port'];
    } catch {
      return [];
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (_btServer && _btServer.connected) {
      try { _btServer.disconnect(); } catch { /* ignore */ }
    }
    _btDevice = null;
    _btServer = null;
    _btCharacteristic = null;

    if (serialPort) {
      try { await serialPort.close(); } catch { /* ignore */ }
      setSerialPort(null);
    }
    setStatus('desconectada');
  }, [serialPort]);

  return {
    config,
    loading,
    connected,
    status,
    tentativa,
    saveConfig,
    lerPeso,
    testarConexao,
    buscarDispositivosSerial,
    disconnect,
    fetchConfig,
    // BT-specific (Web Bluetooth)
    parearNovoDispositivo,
    listarDispositivosPareados,
    conectarDispositivo,
    connectBluetoothWithRetries,
    isBtConnected,
    // Android Bridge scale
    conectarBalancaAndroid,
    desconectarBalancaAndroid,
    isScaleConnectedAndroid,
    listarDispositivosPareadosAndroid,
  };
}
