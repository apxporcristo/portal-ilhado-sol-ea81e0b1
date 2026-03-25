interface AndroidBridge {
  smartPrint(text: string): void;
  smartPrintVoucher?(text: string, qrWifiData: string): void;
  openPrinterConfig(): void;
  autoDetectPrinter(): void;
  readScale?(): string;
}

interface Window {
  IS_ANDROID_APP?: boolean;
  AndroidBridge?: AndroidBridge;
  __print_ok?: (tipo: string) => void;
  __print_err?: (msg: string) => void;
  __printer_config_needed?: () => void;
  __printer_found?: (ip: string) => void;
}
