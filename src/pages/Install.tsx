import { useState, useEffect } from 'react';
import { Download, CheckCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-primary flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Instalar Sistema Voucher</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {isInstalled ? (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="text-muted-foreground">
                App já está instalado! Abra pela tela inicial do seu celular.
              </p>
            </div>
          ) : deferredPrompt ? (
            <>
              <p className="text-muted-foreground">
                Instale o app no seu celular para acesso rápido, sem precisar de loja de aplicativos.
              </p>
              <Button onClick={handleInstall} size="lg" className="w-full gap-2">
                <Download className="w-5 h-5" />
                Instalar Agora
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground">
                Para instalar no seu celular Android:
              </p>
              <ol className="text-left text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Abra este site no <strong>Chrome</strong></li>
                <li>Toque no menu <strong>⋮</strong> (três pontos)</li>
                <li>Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
              </ol>
              <p className="text-xs text-muted-foreground mt-4">
                No iPhone: use o Safari, toque em Compartilhar → "Adicionar à Tela de Início"
              </p>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={() => window.location.href = '/'}>
            Voltar ao Sistema
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
