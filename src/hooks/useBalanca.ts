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

  // ========== BLUETOOTH PERSISTENT CONNECTION ==========

  const isBtConnected = useCallback((): boolean => {
    return !!_btDevice && !!_btServer && _btServer.connected && !!_btCharacteristic;
  }, []);

  const connectToDevice = useCallback(async (device: any): Promise<boolean> => {
    try {
      setStatus('conectando');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('0000fff1-0000-1000-8000-00805f9b34fb');

      _btDevice = device;
      _btServer = server;
      _btCharacteristic = characteristic;

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        console.log('Balança BT desconectada');
        _btServer = null;
        _btCharacteristic = null;
        setStatus('desconectada');
      });

      setStatus('conectada');
      return true;
    } catch (err) {
      console.error('Erro ao conectar BT balança:', err);
      setStatus('falha');
      return false;
    }
  }, []);

  // Try to reconnect to previously saved device (already paired)
  const reconnectSavedDevice = useCallback(async (): Promise<boolean> => {
    // If already connected, reuse
    if (isBtConnected()) {
      setStatus('conectada');
      return true;
    }

    // If we have a device object that was previously paired, try reconnecting
    if (_btDevice && _btDevice.gatt) {
      try {
        return await connectToDevice(_btDevice);
      } catch {
        // Device object stale, clear it
        _btDevice = null;
        _btServer = null;
        _btCharacteristic = null;
      }
    }

    // Try using getDevices() to find previously paired devices
    if ('bluetooth' in navigator && (navigator as any).bluetooth.getDevices) {
      try {
        const devices = await (navigator as any).bluetooth.getDevices();
        if (devices && devices.length > 0) {
          // Try to find the saved device by name
          const savedName = config.dispositivo_nome;
          const savedId = config.dispositivo_id;
          let targetDevice = null;

          if (savedId) {
            targetDevice = devices.find((d: any) => d.id === savedId);
          }
          if (!targetDevice && savedName) {
            targetDevice = devices.find((d: any) => d.name === savedName);
          }
          if (!targetDevice && devices.length > 0) {
            targetDevice = devices[0];
          }

          if (targetDevice) {
            // Need to call watchAdvertisements and wait a bit for GATT to be available
            try {
              if (targetDevice.watchAdvertisements) {
                await targetDevice.watchAdvertisements();
                await new Promise(r => setTimeout(r, 2000));
              }
            } catch { /* some browsers don't support this */ }

            return await connectToDevice(targetDevice);
          }
        }
      } catch (err) {
        console.error('getDevices() falhou:', err);
      }
    }

    return false;
  }, [isBtConnected, connectToDevice, config.dispositivo_nome, config.dispositivo_id]);

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

  // Request new device pairing via browser picker
  const parearNovoDispositivo = useCallback(async (): Promise<boolean> => {
    try {
      if (!('bluetooth' in navigator)) {
        toast({ title: 'Bluetooth indisponível', description: 'Este navegador não suporta Bluetooth.', variant: 'destructive' });
        return false;
      }

      setStatus('conectando');
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb'],
      });

      const ok = await connectToDevice(device);
      if (ok) {
        // Save device info to config
        const newConfig: BalancaConfig = {
          ...config,
          dispositivo_nome: device.name || 'Balança BT',
          dispositivo_id: device.id || null,
        };
        await saveConfig(newConfig);
        toast({ title: 'Balança pareada', description: `Conectado a: ${device.name || 'Dispositivo BT'}` });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao parear BT:', err);
      setStatus('falha');
      return false;
    }
  }, [config, connectToDevice, saveConfig]);

  // List previously paired BT devices
  const listarDispositivosPareados = useCallback(async (): Promise<Array<{ id: string; name: string; device: any }>> => {
    if (!('bluetooth' in navigator)) return [];
    try {
      if ((navigator as any).bluetooth.getDevices) {
        const devices = await (navigator as any).bluetooth.getDevices();
        return (devices || []).map((d: any) => ({
          id: d.id || '',
          name: d.name || 'Dispositivo desconhecido',
          device: d,
        }));
      }
    } catch (err) {
      console.error('Erro listarDispositivosPareados:', err);
    }
    return [];
  }, []);

  // Connect to a specific device from the list
  const conectarDispositivo = useCallback(async (device: any): Promise<boolean> => {
    const ok = await connectToDevice(device);
    if (ok) {
      const newConfig: BalancaConfig = {
        ...config,
        dispositivo_nome: device.name || 'Balança BT',
        dispositivo_id: device.id || null,
      };
      await saveConfig(newConfig);
      return true;
    }
    return false;
  }, [config, connectToDevice, saveConfig]);

  // ========== WEIGHT READING ==========

  const lerPesoBluetooth = useCallback(async (): Promise<number | null> => {
    if (!isBtConnected()) return null;
    try {
      const value = await _btCharacteristic.readValue();
      const bytes = new Uint8Array(value.buffer);
      return parseToledoWeightBytes(bytes);
    } catch (err) {
      console.error('Erro leitura BT:', err);
      return null;
    }
  }, [isBtConnected]);

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

  const lerPesoAndroid = useCallback((): number | null => {
    try {
      const bridge = window.AndroidBridge;
      if (!bridge || !bridge.readScale) return null;
      const raw = bridge.readScale();
      console.log('[Balança] AndroidBridge.readScale() retornou:', raw);
      if (!raw) return null;
      // Try Toledo protocol first, then plain number
      const parsed = parseToledoWeight(raw);
      if (parsed !== null) return parsed;
      const num = parseFloat(raw.replace(',', '.'));
      return isNaN(num) ? null : num;
    } catch {
      return null;
    }
  }, []);

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

  const listarDispositivosPareadosAndroid = useCallback((): Array<{ name: string; address: string }> => {
    try {
      const raw = window.AndroidBridge?.listPairedDevices?.();
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, []);

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
