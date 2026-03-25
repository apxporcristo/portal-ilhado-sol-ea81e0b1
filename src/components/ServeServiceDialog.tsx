import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scale, RefreshCw, Bluetooth, BluetoothSearching } from 'lucide-react';
import { useBalanca } from '@/hooks/useBalanca';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface ServeServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart?: (item: { tempo: string; fichaTexto: string; fichaValor: number }) => void;
}

export function ServeServiceDialog({ open, onOpenChange, onAddToCart }: ServeServiceDialogProps) {
  const { config, lerPeso, status, tentativa, connectBluetoothWithRetries, parearNovoDispositivo } = useBalanca();
  const [peso, setPeso] = useState<number | null>(null);
  const [pesoManual, setPesoManual] = useState('');
  const [lendo, setLendo] = useState(false);

  const valorPeso = config.valor_peso || 0;
  const pesoFinal = peso ?? (parseFloat(pesoManual) || 0);
  const valorTotal = pesoFinal * valorPeso;

  const statusLabel = () => {
    switch (status) {
      case 'conectada': return { text: 'Conectada', variant: 'default' as const };
      case 'conectando': return { text: 'Conectando...', variant: 'secondary' as const };
      case 'tentando': return { text: `Tentando (${tentativa}/3)`, variant: 'secondary' as const };
      case 'falha': return { text: 'Falha', variant: 'destructive' as const };
      default: return { text: 'Desconectada', variant: 'outline' as const };
    }
  };

  const handleLerPeso = useCallback(async () => {
    setLendo(true);
    setPeso(null);

    const resultado = await lerPeso(3);
    if (resultado !== null && resultado > 0) {
      setPeso(resultado);
      toast({ title: 'Peso lido', description: `${resultado.toFixed(3)} kg` });
    } else {
      toast({ title: 'Não foi possível ler o peso', description: 'Digite o peso manualmente.', variant: 'destructive' });
    }
    setLendo(false);
  }, [lerPeso]);

  const handleAdicionar = useCallback(() => {
    if (pesoFinal <= 0) {
      toast({ title: 'Peso inválido', description: 'Informe ou leia o peso antes de adicionar.', variant: 'destructive' });
      return;
    }
    if (valorPeso <= 0) {
      toast({ title: 'Valor não configurado', description: 'Configure o valor por peso nas configurações da balança.', variant: 'destructive' });
      return;
    }

    if (onAddToCart) {
      onAddToCart({
        tempo: `Self Service ${pesoFinal.toFixed(3)}kg`,
        fichaTexto: `Self Service ${pesoFinal.toFixed(3)}kg × R$ ${valorPeso.toFixed(2)}`,
        fichaValor: parseFloat(valorTotal.toFixed(2)),
      });
    }

    toast({
      title: 'Adicionado ao carrinho',
      description: `${pesoFinal.toFixed(3)} kg × R$ ${valorPeso.toFixed(2)} = R$ ${valorTotal.toFixed(2)}`,
    });

    // Limpar para próximo item
    setPeso(null);
    setPesoManual('');
  }, [pesoFinal, valorPeso, valorTotal, onAddToCart]);

  const handleReset = () => {
    setPeso(null);
    setPesoManual('');
  };

  const sl = statusLabel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Serve Service
            {config.tipo_conexao === 'bluetooth' && (
              <Badge variant={sl.variant} className="ml-auto text-xs">{sl.text}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Leia o peso da balança e calcule o valor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleLerPeso} disabled={lendo} className="flex-1">
              <RefreshCw className={`h-4 w-4 mr-2 ${lendo ? 'animate-spin' : ''}`} />
              {lendo ? 'Lendo...' : 'Ler Peso da Balança'}
            </Button>
          </div>

          {/* BT Classic scales require Android app - show guidance */}
          {config.tipo_conexao === 'bluetooth' && !window.IS_ANDROID_APP && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Balança Bluetooth Classic (SPP)</p>
              <p>Balanças seriais usam Bluetooth Classic, que <strong>não é suportado</strong> pelo Chrome/navegador. Use o <strong>app Android auxiliar</strong> para leitura automática, ou digite o peso manualmente abaixo.</p>
            </div>
          )}

          {config.tipo_conexao === 'bluetooth' && window.IS_ANDROID_APP && (status === 'falha' || status === 'desconectada') && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => connectBluetoothWithRetries()} className="flex-1">
                <Bluetooth className="h-4 w-4 mr-2" />
                Reconectar
              </Button>
              <Button variant="outline" size="sm" onClick={() => parearNovoDispositivo()} className="flex-1">
                <BluetoothSearching className="h-4 w-4 mr-2" />
                Parear novo
              </Button>
            </div>
          )}

          {peso !== null ? (
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Peso lido:</p>
              <p className="text-2xl font-bold text-foreground">{peso.toFixed(3)} kg</p>
            </div>
          ) : (
            <div>
              <Label className="text-sm">Peso manual (kg)</Label>
              <Input
                type="number"
                step="0.001"
                value={pesoManual}
                onChange={e => setPesoManual(e.target.value)}
                placeholder="Ex: 0.500"
              />
            </div>
          )}

          <div className="p-3 border rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Peso:</span>
              <span className="font-medium">{pesoFinal.toFixed(3)} kg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor/kg:</span>
              <span className="font-medium">R$ {valorPeso.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-1 mt-1">
              <span>Total:</span>
              <span className="text-primary">R$ {valorTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAdicionar} className="flex-1" disabled={pesoFinal <= 0}>
              Adicionar
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Limpar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
