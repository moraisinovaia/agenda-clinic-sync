import { useEffect, useState } from 'react';

/**
 * Hook para detectar se o Google Translate está ativo na página
 * Previne conflitos DOM conhecidos que causam erros removeChild
 */
export const useGoogleTranslateDetection = () => {
  const [isGoogleTranslateActive, setIsGoogleTranslateActive] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);

  useEffect(() => {
    const detectGoogleTranslate = () => {
      // Detectar elementos comuns do Google Translate
      const googleElements = document.querySelectorAll([
        '[id*="google"]',
        '[class*="google"]', 
        '.goog-te-banner-frame',
        '.goog-te-menu-frame',
        '.goog-te-combo',
        '.skiptranslate'
      ].join(', '));

      // Detectar se a página foi traduzida
      const isTranslated = document.documentElement.lang !== 'pt' && 
                          document.documentElement.lang !== 'pt-BR' &&
                          document.documentElement.lang !== 'en';

      // Detectar meta tags do Google Translate
      const hasGoogleMeta = document.querySelector('meta[name="google"][content*="translate"]') !== null;

      const isActive = googleElements.length > 0 || isTranslated;
      
      if (isActive !== isGoogleTranslateActive) {
        console.log('🔍 Google Translate detectado:', {
          elements: googleElements.length,
          translated: isTranslated,
          hasGoogleMeta,
          lang: document.documentElement.lang
        });
        
        setIsGoogleTranslateActive(isActive);
      }
    };

    // Verificar imediatamente
    detectGoogleTranslate();

    // Verificar periodicamente para mudanças dinâmicas
    const interval = setInterval(detectGoogleTranslate, 2000);

    // Observer para mudanças no DOM
    const observer = new MutationObserver(detectGoogleTranslate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'lang']
    });

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, [isGoogleTranslateActive]);

  const showWarning = () => {
    if (!hasShownWarning && isGoogleTranslateActive) {
      setHasShownWarning(true);
      return true;
    }
    return false;
  };

  const resetWarning = () => {
    setHasShownWarning(false);
  };

  return {
    isGoogleTranslateActive,
    showWarning,
    resetWarning
  };
};