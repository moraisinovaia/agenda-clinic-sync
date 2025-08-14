import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QueryOptions {
  cacheKey: string;
  cacheTime?: number; // in milliseconds
  staleTime?: number; // in milliseconds
  refetchOnMount?: boolean;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

// Cache global para o sistema
const queryCache = new Map<string, CachedData<any>>();

// 🔧 CORREÇÃO: Cache storage mais robusto com localStorage backup
const CACHE_STORAGE_KEY = 'lovable_query_cache_v2';

const saveCache = () => {
  try {
    const cacheData = Object.fromEntries(queryCache.entries());
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
    console.log('💾 Cache salvo no localStorage:', Object.keys(cacheData).length, 'entries');
  } catch (error) {
    console.warn('⚠️ Erro ao salvar cache:', error);
  }
};

const loadCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_STORAGE_KEY);
    if (cached) {
      const cacheData = JSON.parse(cached);
      Object.entries(cacheData).forEach(([key, value]) => {
        queryCache.set(key, value as CachedData<any>);
      });
      console.log('📂 Cache carregado do localStorage:', Object.keys(cacheData).length, 'entries');
    }
  } catch (error) {
    console.warn('⚠️ Erro ao carregar cache:', error);
  }
};

// Carregar cache na inicialização
loadCache();

export const useOptimizedQuery = <T>(
  queryFn: () => Promise<T>,
  dependencies: any[],
  options: QueryOptions
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    cacheKey,
    cacheTime = 5 * 60 * 1000, // 5 minutes default
    staleTime = 30 * 1000, // 30 seconds default
    refetchOnMount = true
  } = options;

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cached = queryCache.get(cacheKey);
      const now = Date.now();

      // 🔍 DEBUG: Log do estado do cache
      console.log('🔍 DEBUG - Cache status:', {
        cacheKey,
        hasCached: !!cached,
        cacheAge: cached ? now - cached.timestamp : 0,
        cacheTime,
        staleTime,
        isExpired: cached ? (now - cached.timestamp) >= cacheTime : true,
        isStale: cached ? (now - cached.timestamp) > staleTime : true
      });

      if (cached && (now - cached.timestamp) < cacheTime) {
        console.log('🔍 DEBUG - Usando dados do cache para:', cacheKey);
        setData(cached.data);
        setLoading(false);
        
        // If data is stale but not expired, return cached and refetch in background
        if ((now - cached.timestamp) > staleTime) {
          console.log('🔍 DEBUG - Dados do cache estão obsoletos, buscando em background:', cacheKey);
          queryFn().then(freshData => {
            console.log('🔍 DEBUG - Background refresh concluído:', cacheKey);
            queryCache.set(cacheKey, {
              data: freshData,
              timestamp: now,
              isStale: false
            });
            setData(freshData);
          }).catch(console.error);
        }
        return;
      }

      // Execute fresh query
      console.log('🔍 DEBUG - Executando query fresh para:', cacheKey);
      const result = await queryFn();
      
      // Cache the result
      queryCache.set(cacheKey, {
        data: result,
        timestamp: now,
        isStale: false
      });

      console.log('🔍 DEBUG - Query executada e cache atualizado:', cacheKey);
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Query error:', err);
    } finally {
      setLoading(false);
    }
  }, [queryFn, cacheKey, cacheTime, staleTime]); // Dependências corretas

  const refetch = useCallback(() => {
    // Clear cache for this key and refetch
    queryCache.delete(cacheKey);
    saveCache(); // Salvar alterações
    console.log(`🔄 Cache invalidated and refetching: ${cacheKey}`);
    return executeQuery();
  }, [cacheKey, executeQuery]);

  // 🔧 CORREÇÃO: Função para limpar cache específico com backup
  const invalidateCache = useCallback(() => {
    queryCache.delete(cacheKey);
    saveCache(); // Salvar alterações
    console.log(`🗑️ Cache invalidated: ${cacheKey}`);
  }, [cacheKey]);

  // 🔧 CORREÇÃO: Função para forçar refetch com limpeza completa
  const forceRefetch = useCallback(async () => {
    console.log(`🔄 FORCE REFETCH iniciado para: ${cacheKey}`);
    
    // Limpeza completa
    queryCache.delete(cacheKey);
    // Também limpar do localStorage
    try {
      const cached = localStorage.getItem(CACHE_STORAGE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        delete cacheData[cacheKey];
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
      }
    } catch (e) {
      console.warn('⚠️ Erro ao limpar localStorage:', e);
    }
    
    setLoading(true);
    setError(null);
    setData(null); // Limpar dados antigos
    
    // Aguardar um pouco para garantir limpeza
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      console.log(`🔄 Executando queryFn para: ${cacheKey}`);
      const result = await queryFn();
      console.log(`✅ QueryFn completada para: ${cacheKey}`, result ? 'com dados' : 'sem dados');
      
      setData(result);
      
      // Cache o resultado se cacheKey estiver definido
      if (cacheTime > 0 && result) {
        const cacheEntry = {
          data: result,
          timestamp: Date.now(),
          isStale: false
        };
        queryCache.set(cacheKey, cacheEntry);
        saveCache();
        console.log(`💾 Dados cacheados para: ${cacheKey}`);
      }
    } catch (err) {
      console.error(`❌ Erro no forceRefetch:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      console.log(`🔄 FORCE REFETCH finalizado para: ${cacheKey}`);
    }
  }, [queryFn, cacheKey, cacheTime]);

  useEffect(() => {
    if (refetchOnMount) {
      executeQuery();
    }
  }, [executeQuery, refetchOnMount]);

  return {
    data,
    loading,
    error,
    refetch,
    invalidateCache,
    forceRefetch
  };
};

// 🔧 CORREÇÃO: Função para limpar todo o cache com localStorage
export const clearAllCache = () => {
  queryCache.clear();
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
    console.log('🧹 Todo o cache foi limpo (memoria + localStorage)');
  } catch (e) {
    console.warn('⚠️ Erro ao limpar localStorage:', e);
  }
};

// 🔧 CORREÇÃO: Função para limpar cache por padrão com localStorage
export const clearCacheByPattern = (pattern: string) => {
  const keysToDelete: string[] = [];
  queryCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => queryCache.delete(key));
  
  // Também limpar do localStorage
  try {
    const cached = localStorage.getItem(CACHE_STORAGE_KEY);
    if (cached) {
      const cacheData = JSON.parse(cached);
      keysToDelete.forEach(key => delete cacheData[key]);
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
    }
  } catch (e) {
    console.warn('⚠️ Erro ao limpar localStorage por padrão:', e);
  }
  
  console.log(`🧹 Cache limpo por padrão "${pattern}":`, keysToDelete);
};