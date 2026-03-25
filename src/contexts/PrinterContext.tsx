import { createContext, useContext, ReactNode } from 'react';
import { usePrinter } from '@/hooks/usePrinter';

type PrinterContextType = ReturnType<typeof usePrinter>;

const PrinterContext = createContext<PrinterContextType | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const printer = usePrinter();
  return (
    <PrinterContext.Provider value={printer}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinterContext(): PrinterContextType {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinterContext must be used within PrinterProvider');
  return ctx;
}
