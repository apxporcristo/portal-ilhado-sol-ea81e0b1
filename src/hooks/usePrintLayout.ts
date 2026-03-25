import { useState } from 'react';

export interface PrintLayoutConfig {
  titleFontSize: number;      // pt
  messageFontSize: number;    // pt
  voucherIdFontSize: number;  // pt
  tempoFontSize: number;      // pt
  dateFontSize: number;       // pt
  qrWidth: number;            // mm
  qrHeight: number;           // mm
  paperWidth: number;         // mm
  paperHeight: number;        // mm
  fichaTitleFontSize: number;    // pt - título da ficha
  fichaSubtitleFontSize: number; // pt - subtítulo
  fichaNumberFontSize: number;   // pt - número sequencial
  fichaInfoFontSize: number;     // pt - valor/data/hora
  // Ficha layout specific
  fichaPaperWidth: number;       // mm
  fichaPaperHeight: number;      // mm
  fichaClienteFontSize: number;  // pt
  fichaAtendenteFontSize: number;// pt
  fichaDataFontSize: number;     // pt
}

const STORAGE_KEY = 'voucher-print-layout';

const defaultConfig: PrintLayoutConfig = {
  titleFontSize: 10,
  messageFontSize: 7,
  voucherIdFontSize: 15,
  tempoFontSize: 8,
  dateFontSize: 6,
  qrWidth: 40,
  qrHeight: 30,
  paperWidth: 58,
  paperHeight: 60,
  fichaTitleFontSize: 10,
  fichaSubtitleFontSize: 8,
  fichaNumberFontSize: 12,
  fichaInfoFontSize: 8,
  fichaPaperWidth: 58,
  fichaPaperHeight: 50,
  fichaClienteFontSize: 8,
  fichaAtendenteFontSize: 8,
  fichaDataFontSize: 6,
};

function syncToWindow(cfg: PrintLayoutConfig) {
  (window as any).__PRINT_CONFIG = {
    paperWidth: cfg.paperWidth,
    paperHeight: cfg.paperHeight,
    qrWidth: cfg.qrWidth,
    qrHeight: cfg.qrHeight,
    titleFont: cfg.titleFontSize,
    messageFont: cfg.messageFontSize,
    voucherFont: cfg.voucherIdFontSize,
    timeFont: cfg.tempoFontSize,
    dateFont: cfg.dateFontSize,
    fichaTitleFont: cfg.fichaTitleFontSize,
    fichaSubtitleFont: cfg.fichaSubtitleFontSize,
    fichaNumberFont: cfg.fichaNumberFontSize,
    fichaInfoFont: cfg.fichaInfoFontSize,
    fichaPaperWidth: cfg.fichaPaperWidth,
    fichaPaperHeight: cfg.fichaPaperHeight,
    fichaClienteFont: cfg.fichaClienteFontSize,
    fichaAtendenteFont: cfg.fichaAtendenteFontSize,
    fichaDataFont: cfg.fichaDataFontSize,
  };
}

// Sync on load
syncToWindow(getPrintLayoutConfigRaw());

export function usePrintLayout() {
  const [config, setConfig] = useState<PrintLayoutConfig>(() => {
    const cfg = getPrintLayoutConfigRaw();
    syncToWindow(cfg);
    return cfg;
  });

  const updateConfig = (partial: Partial<PrintLayoutConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      syncToWindow(next);
      return next;
    });
  };

  const resetConfig = () => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(defaultConfig);
    syncToWindow(defaultConfig);
  };

  return { config, updateConfig, resetConfig };
}

function getPrintLayoutConfigRaw(): PrintLayoutConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return { ...defaultConfig, ...JSON.parse(stored) };
    } catch { /* ignore */ }
  }
  return defaultConfig;
}

export function getPrintLayoutConfig(): PrintLayoutConfig {
  const cfg = getPrintLayoutConfigRaw();
  syncToWindow(cfg);
  return cfg;
}
