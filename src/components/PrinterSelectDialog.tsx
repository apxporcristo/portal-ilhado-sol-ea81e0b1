import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bluetooth, Wifi, Printer } from 'lucide-react';

export interface AvailablePrinter {
  type: 'bluetooth' | 'network' | 'bluetooth_local';
  name: string;
  ip?: string;
  port?: string;
}

interface PrinterSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printers: AvailablePrinter[];
  onSelect: (printer: AvailablePrinter) => void;
}

export function PrinterSelectDialog({
  open,
  onOpenChange,
  printers,
  onSelect,
}: PrinterSelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Selecionar Impressora
          </DialogTitle>
          <DialogDescription>
            Escolha em qual impressora deseja imprimir o voucher.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {printers.map((printer, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={() => {
                onSelect(printer);
                onOpenChange(false);
              }}
            >
              {printer.type === 'bluetooth' ? (
                <Bluetooth className="h-5 w-5 text-blue-500" />
              ) : (
                <Wifi className="h-5 w-5 text-green-500" />
              )}
              <div className="text-left">
                <div className="font-medium">{printer.name}</div>
                <div className="text-xs text-muted-foreground">
                  {printer.type === 'bluetooth' ? 'Bluetooth' : 'Rede'}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
