/**
 * Gerenciador de cache para melhorar performance e resolver problemas DOM
 */

export class CacheManager {
  private static instance: CacheManager;
  
  private constructor() {}
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }
  
  /**
   * Limpa todo o cache da aplicação
   */
  async clearAllCache(): Promise<boolean> {
    try {
      // Limpar localStorage
      localStorage.clear();
      
      // Limpar sessionStorage
      sessionStorage.clear();
      
      // Limpar cache do service worker se disponível
      if ('serviceWorker' in navigator && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        
        // Notificar service worker para limpar cache
        if (navigator.serviceWorker.controller) {
          const messageChannel = new MessageChannel();
          
          return new Promise((resolve) => {
            messageChannel.port1.onmessage = (event) => {
              resolve(event.data.success);
            };
            
            navigator.serviceWorker.controller.postMessage(
              { type: 'CLEAR_CACHE' },
              [messageChannel.port2]
            );
          });
        }
      }
      
      console.log('✅ Cache limpo com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
      return false;
    }
  }
  
  /**
   * Força recarregamento da página com cache limpo
   */
  async forceReload(): Promise<void> {
    try {
      await this.clearAllCache();
      
      // Aguardar um momento para garantir que o cache foi limpo
      setTimeout(() => {
        // Recarregar forçando bypass do cache
        if ('serviceWorker' in navigator) {
          // Desregistrar service worker temporariamente
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach(registration => {
              registration.unregister();
            });
            
            setTimeout(() => {
              window.location.reload();
            }, 100);
          });
        } else {
          window.location.reload();
        }
      }, 200);
    } catch (error) {
      console.error('❌ Erro ao forçar recarregamento:', error);
      window.location.reload();
    }
  }
  
  /**
   * Verifica se há problemas de cache conhecidos
   */
  detectCacheIssues(): { hasIssues: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Verificar se há muitos dados no localStorage
    try {
      const localStorageSize = JSON.stringify(localStorage).length;
      if (localStorageSize > 5 * 1024 * 1024) { // 5MB
        issues.push('localStorage muito grande (>5MB)');
      }
    } catch (error) {
      issues.push('Erro ao acessar localStorage');
    }
    
    // Verificar se service worker está funcionando
    if ('serviceWorker' in navigator) {
      if (!navigator.serviceWorker.controller) {
        issues.push('Service Worker não está ativo');
      }
    }
    
    // Verificar quota de storage
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((estimate) => {
        if (estimate.quota && estimate.usage) {
          const usagePercent = (estimate.usage / estimate.quota) * 100;
          if (usagePercent > 90) {
            issues.push(`Storage quase cheio (${usagePercent.toFixed(1)}%)`);
          }
        }
      });
    }
    
    return {
      hasIssues: issues.length > 0,
      issues
    };
  }
  
  /**
   * Otimiza o cache removendo dados antigos
   */
  async optimizeCache(): Promise<void> {
    try {
      // Remover dados antigos do localStorage
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && this.isOldCacheKey(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log(`🧹 Cache otimizado: ${keysToRemove.length} chaves antigas removidas`);
    } catch (error) {
      console.error('❌ Erro ao otimizar cache:', error);
    }
  }
  
  private isOldCacheKey(key: string): boolean {
    // Remover dados antigos baseado em padrões conhecidos
    const oldPatterns = [
      'endogastro-',
      'supabase.auth.token',
      'sb-',
      'react-query-',
      'temp-'
    ];
    
    return oldPatterns.some(pattern => key.startsWith(pattern));
  }
}

// Exportar instância singleton
export const cacheManager = CacheManager.getInstance();