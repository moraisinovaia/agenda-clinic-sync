/**
 * Utilitários para limpeza de DOM e prevenção de conflitos
 * Especialmente útil para resolver problemas com Google OAuth e removeChild
 */

/**
 * Remove elementos DOM órfãos do Google OAuth que podem causar conflitos
 */
export const cleanupGoogleOAuthElements = () => {
  try {
    // Elementos comuns do Google OAuth que podem ficar órfãos
    const selectors = [
      '[id*="google"]',
      '[class*="google"]',
      '[data-testid*="google"]',
      'iframe[src*="accounts.google.com"]',
      'div[role="presentation"][style*="position: absolute"]',
      '.g_id_signin',
      '#g_id_onload'
    ];

    let removedCount = 0;

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        try {
          // Verificar se o elemento ainda tem um pai antes de tentar remover
          if (element.parentNode) {
            element.parentNode.removeChild(element);
            removedCount++;
          }
        } catch (error) {
          // Silenciosamente ignorar erros de remoção
          console.debug('Elemento já foi removido:', selector);
        }
      });
    });

    if (removedCount > 0) {
      console.log(`🧹 DOM Cleanup: Removidos ${removedCount} elementos Google OAuth órfãos`);
    }

    return removedCount;
  } catch (error) {
    console.warn('⚠️ Erro durante limpeza DOM:', error);
    return 0;
  }
};

/**
 * Verifica se existem elementos DOM potencialmente problemáticos
 */
export const detectProblematicElements = (): {
  googleElements: number;
  orphanedIframes: number;
  absolutePositioned: number;
} => {
  try {
    const googleElements = document.querySelectorAll('[id*="google"], [class*="google"]').length;
    const orphanedIframes = document.querySelectorAll('iframe:not([src])').length;
    const absolutePositioned = document.querySelectorAll('div[style*="position: absolute"][style*="z-index"]').length;

    return {
      googleElements,
      orphanedIframes,
      absolutePositioned
    };
  } catch (error) {
    return { googleElements: 0, orphanedIframes: 0, absolutePositioned: 0 };
  }
};

/**
 * Operação segura de manipulação DOM com verificações
 */
export const safeDOMOperation = (operation: () => void, context = 'DOM Operation') => {
  try {
    // Aguardar o próximo frame para garantir que o DOM esteja estável
    requestAnimationFrame(() => {
      try {
        operation();
      } catch (error) {
        console.warn(`⚠️ Erro em ${context}:`, error);
      }
    });
  } catch (error) {
    console.warn(`⚠️ Erro ao agendar ${context}:`, error);
  }
};