import { useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { toast } from '@/hooks/use-toast';

export function isAndroidApp(): boolean {
  return window.IS_ANDROID_APP === true;
}

let _bridgeReady = isAndroidApp();
const _listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getSnapshot() {
  return _bridgeReady;
}

export function useAndroidBridge() {
  const bridgeReady = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!bridgeReady) {
      const interval = setInterval(() => {
        if (isAndroidApp() && !_bridgeReady) {
          _bridgeReady = true;
          _listeners.forEach(cb => cb());
          clearInterval(interval);
        }
      }, 300);
      const timeout = setTimeout(() => clearInterval(interval), 5000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [bridgeReady]);

  useEffect(() => {
    window.__print_ok = (tipo: string) => {
      toast({ title: 'Impressão realizada', description: `Impressão via ${tipo}` });
    };
    window.__print_err = (msg: string) => {
      toast({ title: 'Erro ao imprimir', description: `Erro: ${msg}`, variant: 'destructive' });
    };
    window.__printer_config_needed = () => {
      toast({ title: 'Impressora não configurada', description: 'Nenhuma impressora configurada.', variant: 'destructive' });
    };
    window.__printer_found = (ip: string) => {
      console.log('Impressora encontrada:', ip);
      toast({ title: 'Impressora encontrada', description: `Impressora encontrada: ${ip}` });
    };
    window.__scale_weight = (weight: string) => {
      console.log('[AndroidBridge] Peso recebido:', weight);
    };
    window.__scale_connected = () => {
      console.log('[AndroidBridge] Balança conectada');
      toast({ title: 'Balança conectada' });
    };
    window.__scale_disconnected = () => {
      console.log('[AndroidBridge] Balança desconectada');
    };
    window.__scale_error = (msg: string) => {
      console.error('[AndroidBridge] Erro balança:', msg);
      toast({ title: 'Erro na balança', description: msg, variant: 'destructive' });
    };

    return () => {
      delete window.__print_ok;
      delete window.__print_err;
      delete window.__printer_config_needed;
      delete window.__printer_found;
      delete window.__scale_weight;
      delete window.__scale_connected;
      delete window.__scale_disconnected;
      delete window.__scale_error;
    };
  }, []);

  const isAvailable = useCallback(() => {
    return bridgeReady;
  }, [bridgeReady]);

  const smartPrint = useCallback((text: string) => {
    if (isAndroidApp()) {
      window.AndroidBridge!.smartPrint(text);
      return true;
    }
    toast({
      title: 'Indisponível',
      description: 'Abra este sistema pelo aplicativo Android para usar impressora.',
      variant: 'destructive',
    });
    return false;
  }, []);

  const openPrinterConfig = useCallback(() => {
    if (isAndroidApp()) {
      window.AndroidBridge!.openPrinterConfig();
      return true;
    }
    toast({
      title: 'Indisponível',
      description: 'Abra este sistema pelo aplicativo Android para configurar impressora.',
      variant: 'destructive',
    });
    return false;
  }, []);

  const autoDetectPrinter = useCallback(() => {
    if (isAndroidApp()) {
      window.AndroidBridge!.autoDetectPrinter();
      return true;
    }
    toast({
      title: 'Indisponível',
      description: 'Abra este sistema pelo aplicativo Android para usar impressora.',
      variant: 'destructive',
    });
    return false;
  }, []);

  const testPrint = useCallback(() => {
    const networkName = localStorage.getItem('voucher-network-name') || 'ILHA DO SOL';
    const currentDate = new Date().toLocaleDateString('pt-BR');
    return smartPrint(
      "VOUCHER DE ACESSO\n" +
      "\n" +
      `Rede: ${networkName}\n` +
      "Voucher: TESTE123\n" +
      "Tempo: 3 Minutos\n" +
      `Coloque no modo avião antes de acessar a rede "${networkName}"\n` +
      `Data: ${currentDate}`
    );
  }, [smartPrint]);

  return { isAvailable, smartPrint, openPrinterConfig, autoDetectPrinter, testPrint };
}
