import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { getWifiQrString } from '@/hooks/useNetworkName';
import { getPrintLayoutConfig } from '@/hooks/usePrintLayout';
import type { 
  BluetoothDevice, 
  BluetoothRemoteGATTCharacteristic 
} from '@/types/web-bluetooth.d';

export type PrinterType = 'network' | 'bluetooth' | 'browser';

export interface PrinterConfig {
  type: PrinterType;
  // Network config
  networkIp?: string;
  networkPort?: string;
  // Bluetooth config
  bluetoothDevice?: BluetoothDevice;
  bluetoothDeviceName?: string;
}

export interface BluetoothPrinterDevice {
  device: BluetoothDevice;
  name: string;
  id: string;
}

interface PrinterStatus {
  status: 'idle' | 'scanning' | 'connecting' | 'connected' | 'testing' | 'error';
  message?: string;
}

const STORAGE_KEY = 'voucher_printer_config';

// ESC/POS Commands
const ESC_POS = {
  INIT: new Uint8Array([0x1B, 0x40]), // Initialize printer
  CUT: new Uint8Array([0x1D, 0x56, 0x00]), // Full cut
  FEED: new Uint8Array([0x1B, 0x64, 0x04]), // Feed ~5mm (4 lines) before cut
  ALIGN_CENTER: new Uint8Array([0x1B, 0x61, 0x01]), // Center align
  ALIGN_LEFT: new Uint8Array([0x1B, 0x61, 0x00]), // Left align
  BOLD_ON: new Uint8Array([0x1B, 0x45, 0x01]), // Bold on
  BOLD_OFF: new Uint8Array([0x1B, 0x45, 0x00]), // Bold off
  SIZE_NORMAL: new Uint8Array([0x1D, 0x21, 0x00]), // Normal size
  SIZE_DOUBLE_H: new Uint8Array([0x1D, 0x21, 0x01]), // Double height only
  SIZE_DOUBLE: new Uint8Array([0x1D, 0x21, 0x11]), // Double height and width
};

// Map font size (pt) to ESC/POS size command - same logic as ficha layout
function escposSizeCmd(size: number): Uint8Array {
  if (size >= 15) return ESC_POS.SIZE_DOUBLE;      // Double width + height
  if (size >= 11) return ESC_POS.SIZE_DOUBLE_H;     // Double height only
  return ESC_POS.SIZE_NORMAL;                        // Normal
}

export function usePrinter() {
  const [config, setConfig] = useState<PrinterConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          type: parsed.type || 'browser',
          networkIp: parsed.networkIp || '',
          networkPort: parsed.networkPort || '9100',
          bluetoothDeviceName: parsed.bluetoothDeviceName || '',
        };
      } catch {
        return { type: 'browser' };
      }
    }
    return { type: 'browser' };
  });

  const [status, setStatus] = useState<PrinterStatus>({ status: 'idle' });
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothPrinterDevice[]>([]);
  const [bluetoothCharacteristic, setBluetoothCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const qrRasterCacheRef = useRef<Map<string, number[]>>(new Map());

  const updateConfig = useCallback((newConfig: Partial<PrinterConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const saveConfig = useCallback(() => {
    const toSave = {
      type: config.type,
      networkIp: config.networkIp,
      networkPort: config.networkPort,
      bluetoothDeviceName: config.bluetoothDeviceName,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    
    toast({
      title: 'Configuração salva',
      description: 'Configurações da impressora foram salvas.',
    });
  }, [config]);

  const checkBluetoothAvailability = useCallback(async (): Promise<'available' | 'disabled' | 'unsupported'> => {
    if (!navigator.bluetooth) {
      return 'unsupported';
    }
    try {
      const available = await navigator.bluetooth.getAvailability();
      return available ? 'available' : 'disabled';
    } catch {
      // getAvailability() not supported in all browsers, assume available if bluetooth API exists
      return 'available';
    }
  }, []);

  const scanBluetoothDevices = useCallback(async (): Promise<BluetoothPrinterDevice[]> => {
    const btStatus = await checkBluetoothAvailability();

    if (btStatus === 'unsupported') {
      setStatus({ status: 'error', message: 'Bluetooth não suportado neste navegador' });
      toast({
        title: 'Bluetooth não suportado',
        description: 'Este navegador não suporta Web Bluetooth. Use Chrome ou Edge.',
        variant: 'destructive',
      });
      return [];
    }

    if (btStatus === 'disabled') {
      setStatus({ status: 'error', message: 'Bluetooth está desligado no dispositivo' });
      toast({
        title: 'Bluetooth desligado',
        description: 'Ative o Bluetooth nas configurações do seu dispositivo e tente novamente.',
        variant: 'destructive',
      });
      return [];
    }

    setStatus({ status: 'scanning', message: 'Buscando dispositivos Bluetooth...' });

    try {
      // Request any Bluetooth device (user will select from browser dialog)
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Serial Port Profile
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Nordic UART Service
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Custom printer service
        ],
      });

      const newDevice: BluetoothPrinterDevice = {
        device: device as BluetoothDevice,
        name: device.name || 'Dispositivo Desconhecido',
        id: device.id,
      };

      setBluetoothDevices(prev => {
        const exists = prev.find(d => d.id === device.id);
        if (exists) return prev;
        return [...prev, newDevice];
      });

      setStatus({ status: 'idle', message: 'Dispositivo encontrado' });
      
      toast({
        title: 'Dispositivo encontrado',
        description: `${device.name || 'Dispositivo'} foi adicionado à lista.`,
      });

      return [newDevice];
    } catch (error) {
      console.error('Erro ao buscar Bluetooth:', error);
      
      if ((error as Error).name === 'NotFoundError') {
        setStatus({ status: 'idle', message: 'Busca cancelada' });
      } else {
        setStatus({ status: 'error', message: 'Erro ao buscar dispositivos' });
        toast({
          title: 'Erro',
          description: 'Não foi possível buscar dispositivos Bluetooth.',
          variant: 'destructive',
        });
      }
      return [];
    }
  }, []);

  const connectBluetooth = useCallback(async (device: BluetoothDevice): Promise<BluetoothRemoteGATTCharacteristic | null> => {
    setStatus({ status: 'connecting', message: 'Conectando...' });

    try {
      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Não foi possível conectar ao servidor GATT');
      }

      const services = await server.getPrimaryServices();
      
      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              setBluetoothCharacteristic(char);
              setConfig(prev => ({
                ...prev,
                bluetoothDevice: device,
                bluetoothDeviceName: device.name || 'Impressora Bluetooth',
              }));
              setStatus({ status: 'connected', message: `Conectado a ${device.name}` });
              
              toast({
                title: 'Conectado',
                description: `Impressora ${device.name} conectada com sucesso!`,
              });
              return char;
            }
          }
        } catch {
          continue;
        }
      }

      throw new Error('Nenhuma característica de escrita encontrada');
    } catch (error) {
      console.error('Erro ao conectar Bluetooth:', error);
      setStatus({ status: 'error', message: 'Erro ao conectar' });
      toast({
        title: 'Erro',
        description: 'Não foi possível conectar à impressora Bluetooth.',
        variant: 'destructive',
      });
      return null;
    }
  }, []);

  const writeToCharacteristic = useCallback(async (characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array): Promise<void> => {
    // Balance reliability + speed for thermal BLE printers
    let chunkSize = 180;
    let delay = 10;
    let switchedToSafeMode = false;

    const canWriteWithResponse = characteristic.properties.write;
    const canWriteWithoutResponse = characteristic.properties.writeWithoutResponse;

    const toBufferSource = (chunk: Uint8Array): BufferSource =>
      chunk as unknown as BufferSource;

    const writePrimary = async (chunk: Uint8Array) => {
      const payload = toBufferSource(chunk);
      if (canWriteWithResponse) {
        await characteristic.writeValueWithResponse(payload);
      } else if (canWriteWithoutResponse) {
        await characteristic.writeValueWithoutResponse(payload);
      } else {
        await characteristic.writeValue(payload);
      }
    };

    const writeFallback = async (chunk: Uint8Array) => {
      const payload = toBufferSource(chunk);
      if (canWriteWithoutResponse && canWriteWithResponse) {
        await characteristic.writeValueWithoutResponse(payload);
      } else if (canWriteWithResponse) {
        await characteristic.writeValueWithResponse(payload);
      } else {
        await characteristic.writeValue(payload);
      }
    };

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      try {
        await writePrimary(chunk);
      } catch (err) {
        if (!switchedToSafeMode && chunkSize > 20) {
          console.warn('BLE write unstable, switching to safe mode (20 bytes)', err);
          chunkSize = 20;
          delay = 20;
          switchedToSafeMode = true;
          i -= chunkSize;
          continue;
        }

        try {
          await writeFallback(chunk);
        } catch (err2) {
          console.error('Both BLE write methods failed for chunk', i, err2);
          throw err2;
        }
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }, []);

  const testConnection = useCallback(async (): Promise<boolean> => {
    setStatus({ status: 'testing', message: 'Testando comunicação...' });

    if (config.type === 'bluetooth') {
      if (!bluetoothCharacteristic) {
        setStatus({ status: 'error', message: 'Impressora não conectada' });
        toast({
          title: 'Erro',
          description: 'Conecte a impressora Bluetooth primeiro.',
          variant: 'destructive',
        });
        return false;
      }

      try {
        // Send test command
        const testData = new Uint8Array([
          ...ESC_POS.INIT,
          ...ESC_POS.ALIGN_CENTER,
          ...ESC_POS.BOLD_ON,
          ...new TextEncoder().encode('TESTE DE IMPRESSAO'),
          0x0A,
          ...ESC_POS.BOLD_OFF,
          ...new TextEncoder().encode('Comunicacao OK!'),
          0x0A,
          ...ESC_POS.FEED,
          ...ESC_POS.CUT,
        ]);

        await writeToCharacteristic(bluetoothCharacteristic, testData);
        
        setStatus({ status: 'connected', message: 'Teste enviado com sucesso!' });
        toast({
          title: 'Teste enviado',
          description: 'Comando de teste enviado para a impressora.',
        });
        return true;
      } catch (error) {
        console.error('Erro no teste:', error);
        setStatus({ status: 'error', message: 'Erro ao enviar teste' });
        toast({
          title: 'Erro',
          description: `Falha ao enviar comando de teste: ${(error as Error).message}`,
          variant: 'destructive',
        });
        return false;
      }
    }

    if (config.type === 'network') {
      if (!config.networkIp || !config.networkPort) {
        setStatus({ status: 'error', message: 'Configure IP e porta' });
        toast({
          title: 'Erro',
          description: 'Configure o IP e a porta da impressora.',
          variant: 'destructive',
        });
        return false;
      }

      try {
        // When running inside Android app, prefer native bridge (works on local LAN)
        if (window.IS_ANDROID_APP === true && window.AndroidBridge?.smartPrint) {
          const networkName = localStorage.getItem('voucher-network-name') || 'ILHA DO SOL';
          const currentDate = new Date().toLocaleDateString('pt-BR');
          window.AndroidBridge.smartPrint(
            "TESTE DE IMPRESSAO\n" +
            "Comunicacao OK!\n" +
            `Rede: ${networkName}\n` +
            `IP: ${config.networkIp}:${config.networkPort}\n` +
            `Data: ${currentDate}`
          );

          setStatus({ status: 'connected', message: 'Teste enviado via app Android (rede local)' });
          toast({
            title: 'Teste enviado',
            description: `Comando enviado para impressão local em ${config.networkIp}:${config.networkPort}`,
          });
          return true;
        }

        // Web mode: send through backend function
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-network`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ ip: config.networkIp, port: config.networkPort, test: true }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao comunicar com impressora');

        setStatus({ status: 'connected', message: 'Teste enviado com sucesso!' });
        toast({
          title: 'Teste enviado',
          description: `Página de teste enviada para ${config.networkIp}:${config.networkPort}`,
        });
        return true;
      } catch (error) {
        console.error('Erro no teste de rede:', error);
        const isTimeout = (error as Error).name === 'AbortError' || (error as Error).message.includes('10 segundos');
        const msg = isTimeout
          ? 'Falha de comunicação em 10 segundos. Se a impressora está em rede local, use o app Android para impressão local.'
          : (error as Error).message;

        setStatus({ status: 'error', message: msg });
        toast({
          title: 'Falha de comunicação',
          description: msg,
          variant: 'destructive',
        });
        return false;
      }
    }

    // Browser mode - always works
    setStatus({ status: 'connected', message: 'Modo navegador ativo' });
    toast({
      title: 'Modo navegador',
      description: 'Impressão via diálogo do navegador.',
    });
    return true;
  }, [config, bluetoothCharacteristic]);

  const isBluetoothConnected = useCallback((): boolean => {
    if (!config.bluetoothDevice) return false;
    try {
      return config.bluetoothDevice.gatt?.connected === true && bluetoothCharacteristic !== null;
    } catch {
      return false;
    }
  }, [config.bluetoothDevice, bluetoothCharacteristic]);

  // Silent reconnect: uses getDevices() to reconnect without showing picker
  const silentReconnectBluetooth = useCallback(async (): Promise<BluetoothRemoteGATTCharacteristic | null> => {
    // 1) Try device already in memory
    if (config.bluetoothDevice) {
      try {
        const char = await connectBluetooth(config.bluetoothDevice);
        if (char) return char;
      } catch {
        // failed, try getDevices
      }
    }

    // 2) Try getDevices() — returns previously paired devices without picker
    if (navigator.bluetooth?.getDevices) {
      try {
        const devices = await navigator.bluetooth.getDevices();
        const savedName = config.bluetoothDeviceName;
        // Try saved name first, then any device
        const target = savedName
          ? devices.find(d => d.name === savedName) || devices[0]
          : devices[0];
        if (target) {
          console.log(`Tentando reconectar silenciosamente a "${target.name}"...`);
          const char = await connectBluetooth(target as BluetoothDevice);
          if (char) return char;
        }
      } catch (err) {
        console.warn('getDevices() falhou:', err);
      }
    }

    return null;
  }, [config.bluetoothDevice, config.bluetoothDeviceName, connectBluetooth]);

  // Full reconnect: opens picker dialog for user selection
  const reconnectBluetooth = useCallback(async (): Promise<BluetoothRemoteGATTCharacteristic | null> => {
    console.log('Abrindo picker Bluetooth para seleção manual...');
    toast({
      title: 'Selecione a impressora',
      description: config.bluetoothDeviceName
        ? `Não foi possível reconectar a "${config.bluetoothDeviceName}". Selecione na janela do navegador.`
        : 'Selecione a impressora Bluetooth na janela do navegador.',
    });
    try {
      const devices = await scanBluetoothDevices();
      if (devices.length > 0) {
        return await connectBluetooth(devices[0].device);
      }
    } catch {
      // user cancelled picker
    }
    return null;
  }, [config.bluetoothDeviceName, connectBluetooth, scanBluetoothDevices]);

  const printData = useCallback(async (data: Uint8Array, directCharacteristic?: BluetoothRemoteGATTCharacteristic): Promise<boolean> => {
    const char = directCharacteristic || bluetoothCharacteristic;
    if (config.type === 'bluetooth' && char) {
      try {
        await writeToCharacteristic(char, data);
        return true;
      } catch (error) {
        console.error('Erro ao imprimir via Bluetooth:', error);
        toast({
          title: 'Erro de impressão',
          description: `Falha ao imprimir via Bluetooth: ${(error as Error).message}`,
          variant: 'destructive',
        });
        return false;
      }
    }

    if (config.type === 'network' && config.networkIp && config.networkPort) {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/print-network`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            ip: config.networkIp, 
            port: config.networkPort, 
            data: Array.from(data),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erro ao imprimir');
        return true;
      } catch (error) {
        console.error('Erro ao imprimir via rede:', error);
        toast({
          title: 'Erro de impressão',
          description: (error as Error).message,
          variant: 'destructive',
        });
        return false;
      }
    }

    // Browser mode - fall back to window.print()
    return false;
  }, [config, bluetoothCharacteristic, writeToCharacteristic]);

  const createQRCodeCommands = useCallback((text: string, moduleSize: number = 6): number[] => {
    // ESC/POS native QR Code commands (may not work on all printers)
    const data: number[] = [];
    const encoded = new TextEncoder().encode(text);
    const storeLen = encoded.length + 3;
    const pL = storeLen % 256;
    const pH = Math.floor(storeLen / 256);

    data.push(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    const clampedSize = Math.max(1, Math.min(16, moduleSize));
    data.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, clampedSize);
    data.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);
    data.push(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...encoded);
    data.push(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);

    return data;
  }, []);

  /**
   * Generate QR code as raster bitmap image (GS v 0).
   * Universally supported by thermal printers, unlike native QR commands.
   */
  const createQRCodeRasterCommands = useCallback(async (text: string, widthMm: number = 40): Promise<number[]> => {
    // Use configured width, clamp to paper limits (58mm paper = ~48mm printable)
    const safeWidthMm = Math.max(15, Math.min(48, widthMm));
    const cacheKey = `${text}::${safeWidthMm}`;
    const cached = qrRasterCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const QRCodeLib = await import('qrcode');

    // 203 DPI ≈ 8 dots/mm. Max 384 dots for 58mm paper.
    const dotsPerMm = 8;
    const qrPixels = Math.min(384, Math.round(safeWidthMm * dotsPerMm));
    const targetWidth = Math.max(8, Math.floor(qrPixels / 8) * 8);

    const canvas = document.createElement('canvas');
    await QRCodeLib.toCanvas(canvas, text, {
      width: targetWidth,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    const bytesPerLine = Math.ceil(w / 8);
    const data: number[] = [];

    // GS v 0: print raster bit image
    data.push(0x1D, 0x76, 0x30, 0x00);
    data.push(bytesPerLine % 256, Math.floor(bytesPerLine / 256));
    data.push(h % 256, Math.floor(h / 256));

    for (let y = 0; y < h; y++) {
      for (let byteIdx = 0; byteIdx < bytesPerLine; byteIdx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = byteIdx * 8 + bit;
          if (x < w) {
            const pixelOffset = (y * w + x) * 4;
            const r = pixels[pixelOffset];
            const g = pixels[pixelOffset + 1];
            const b = pixels[pixelOffset + 2];
            const gray = (r * 0.299) + (g * 0.587) + (b * 0.114);
            if (gray < 160) byte |= (0x80 >> bit);
          }
        }
        data.push(byte);
      }
    }

    qrRasterCacheRef.current.set(cacheKey, data);
    return data;
  }, []);

  const createVoucherData = useCallback(async (voucherId: string, tempo: string): Promise<Uint8Array> => {
    const layout = getPrintLayoutConfig();
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const networkName = localStorage.getItem('voucher-network-name') || 'ILHA DO SOL';

    const encoder = new TextEncoder();


    // Determine ESC/POS size commands from layout config
    const titleSizeCmd = escposSizeCmd(layout.titleFontSize ?? 10);
    const voucherIdSizeCmd = escposSizeCmd(layout.voucherIdFontSize ?? 15);
    const messageSizeCmd = escposSizeCmd(layout.messageFontSize ?? 7);
    const tempoSizeCmd = escposSizeCmd(layout.tempoFontSize ?? 8);
    const dateSizeCmd = escposSizeCmd(layout.dateFontSize ?? 6);

    // Check if tempo is less than 1 hour to hide airplane mode instructions
    const tempoNum = parseInt(tempo) || 0;
    const isLessThanOneHour = tempoNum < 1 || tempo.toLowerCase().includes('min');

    const instructionBytes: number[] = [];
    if (!isLessThanOneHour) {
      instructionBytes.push(
        ...messageSizeCmd,
        ...ESC_POS.ALIGN_LEFT,
        ...encoder.encode('Ative o modo aviao,'),
        0x0A,
        ...encoder.encode(`acesse a REDE ${networkName}.`),
        0x0A,
        ...encoder.encode('Apos acessar, nao retirar'),
        0x0A,
        ...encoder.encode('do modo aviao.'),
        0x0A,
        ...ESC_POS.SIZE_NORMAL,
        0x0A,
        0x0A,
      );
    } else {
      instructionBytes.push(
        ...messageSizeCmd,
        ...ESC_POS.ALIGN_LEFT,
        ...encoder.encode(`Acesse a REDE ${networkName}.`),
        0x0A,
        ...ESC_POS.SIZE_NORMAL,
        0x0A,
      );
    }

    // Generate WiFi QR code only if QR dimensions are configured
    const showQr = layout.qrWidth > 0 && layout.qrHeight > 0;
    let wifiQrCommands: number[] = [];
    if (showQr) {
      const wifiQrString = getWifiQrString();
      try {
        wifiQrCommands = await createQRCodeRasterCommands(wifiQrString, layout.qrWidth);
      } catch (err) {
        console.warn('Raster QR failed, falling back to native ESC/POS QR', err);
        const qrModuleSize = Math.max(3, Math.min(16, Math.round(layout.qrWidth / 4)));
        wifiQrCommands = createQRCodeCommands(wifiQrString, qrModuleSize);
      }
    }

    // Build parts separately to avoid spread on huge arrays
    const header = [
      ...ESC_POS.INIT,
      ...ESC_POS.ALIGN_CENTER,
      ...titleSizeCmd,
      ...ESC_POS.BOLD_ON,
      ...encoder.encode('VOUCHER DE ACESSO'),
      0x0A,
      ...ESC_POS.SIZE_NORMAL,
      0x0A,
      ...ESC_POS.BOLD_OFF,
    ];

    const afterQr = [
      0x0A,
      ...ESC_POS.BOLD_ON,
      ...voucherIdSizeCmd,
      ...encoder.encode(voucherId),
      0x0A,
      ...ESC_POS.SIZE_NORMAL,
      ...ESC_POS.BOLD_OFF,
      0x0A,
      ...tempoSizeCmd,
      ...encoder.encode(`Tempo de conexao: ${tempo}`),
      0x0A,
      ...ESC_POS.SIZE_NORMAL,
      0x0A,
      ...instructionBytes,
      ...ESC_POS.ALIGN_CENTER,
      ...dateSizeCmd,
      ...encoder.encode(`Data: ${currentDate} ${currentTime}`),
      ...ESC_POS.SIZE_NORMAL,
      ...ESC_POS.FEED,
      ...ESC_POS.CUT,
    ];

    // Concatenate using set() to avoid stack overflow with spread on large raster data
    const totalLen = header.length + wifiQrCommands.length + afterQr.length;
    const data = new Uint8Array(totalLen);
    data.set(header, 0);
    data.set(wifiQrCommands, header.length);
    data.set(afterQr, header.length + wifiQrCommands.length);

    return data;
  }, [createQRCodeCommands, createQRCodeRasterCommands]);

  return {
    config,
    status,
    bluetoothDevices,
    updateConfig,
    saveConfig,
    scanBluetoothDevices,
    connectBluetooth,
    testConnection,
    printData,
    createVoucherData,
    isBluetoothConnected,
    reconnectBluetooth,
    silentReconnectBluetooth,
  };
}
