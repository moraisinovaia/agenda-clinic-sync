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
    // Debug inicial - verificar se o PWA está sendo reconhecido
    console.log('🔍 PWA Debug - Verificando estado inicial:', {
      hasServiceWorker: 'serviceWorker' in navigator,
      hasManifest: document.querySelector('link[rel="manifest"]') !== null,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      userAgent: navigator.userAgent.substring(0, 100)
    });

    // Verificar se já está instalado
    const checkIfInstalled = () => {
      // Verificar se está rodando como PWA
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isInWebAppiOS = isIOS && (window.navigator as any).standalone;
      
      const installed = isStandalone || isInWebAppiOS;
      console.log('✅ PWA: Check if installed -', { installed, isStandalone, isInWebAppiOS });
      setIsInstalled(installed);
    };

    checkIfInstalled();

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🚀 PWA: beforeinstallprompt fired - App é instalável!');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('🎉 PWA: App foi instalado com sucesso!');
      setIsInstallable(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    // Timeout para verificar se o evento beforeinstallprompt não disparou
    const debugTimeout = setTimeout(() => {
      if (!deferredPrompt && !isInstalled) {
        console.log('⚠️ PWA: beforeinstallprompt não disparou após 3s. Possíveis causas:', {
          manifestPresent: !!document.querySelector('link[rel="manifest"]'),
          httpsProtocol: location.protocol === 'https:',
          serviceWorkerRegistered: 'serviceWorker' in navigator
        });
      }
    }, 3000);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Remover a lógica de debug que causava logs repetidos

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(debugTimeout);
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