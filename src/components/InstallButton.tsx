import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar se já está instalado
    const checkIfInstalled = () => {
      // Verificar se está rodando como PWA
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isInWebAppiOS = isIOS && (window.navigator as any).standalone;
      
      setIsInstalled(isStandalone || isInWebAppiOS);
    };

    checkIfInstalled();

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt fired');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setIsInstallable(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Remover a lógica de debug que causava logs repetidos

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }

      // Clear the deferredPrompt
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      // Fallback para navegadores sem suporte ao beforeinstallprompt
      alert('Para instalar o app:\n\n1. Chrome/Edge: Menu > Instalar INOVAIA\n2. Firefox: Menu > Adicionar à tela inicial\n3. Safari: Compartilhar > Adicionar à tela inicial');
    }
  };

  // Não mostrar se já está instalado
  if (isInstalled) return null;

  // Mostrar sempre o botão se não estiver instalado (para debug e suporte amplo)
  return (
    <Button 
      onClick={handleInstallClick}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
      title={deferredPrompt ? "Instalar aplicativo" : "Instruções de instalação"}
    >
      <Download className="h-4 w-4" />
      Instalar App
    </Button>
  );
}