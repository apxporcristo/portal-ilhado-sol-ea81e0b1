interface AndroidBridge {
  smartPrint(text: string): void;
  smartPrintVoucher?(text: string, qrWifiData: string): void;
  openPrinterConfig(): void;
  autoDetectPrinter(): void;

  // Scale (Bluetooth serial)
  readScale?(): string;
  connectScale?(address: string, baudRate: number): boolean;
  disconnectScale?(): void;
  isScaleConnected?(): boolean;
  listPairedDevices?(): string; // JSON array of {name, address}
}

interface Window {
  IS_ANDROID_APP?: boolean;
  AndroidBridge?: AndroidBridge;
  __print_ok?: (tipo: string) => void;
  __print_err?: (msg: string) => void;
  __printer_config_needed?: () => void;
  __printer_found?: (ip: string) => void;
  __scale_weight?: (weight: string) => void;
  __scale_connected?: () => void;
  __scale_disconnected?: () => void;
  __scale_error?: (msg: string) => void;
}
