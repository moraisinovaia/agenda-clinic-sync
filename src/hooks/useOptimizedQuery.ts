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

const queryCache = new Map<string, CachedData<any>>();

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
    console.log(`🔄 Cache invalidated and refetching: ${cacheKey}`);
    return executeQuery();
  }, [cacheKey, executeQuery]);

  const invalidateCache = useCallback(() => {
    queryCache.delete(cacheKey);
    console.log(`🗑️ Cache invalidated: ${cacheKey}`);
  }, [cacheKey]);

  const forceRefetch = useCallback(async () => {
    // Force fresh data from server, bypassing cache completely
    queryCache.delete(cacheKey);
    console.log(`🚀 Force refetching: ${cacheKey}`);
    
    try {
      setLoading(true);
      setError(null);
      
      const result = await queryFn();
      const now = Date.now();
      
      queryCache.set(cacheKey, {
        data: result,
        timestamp: now,
        isStale: false
      });
      
      setData(result);
      console.log(`✅ Fresh data loaded: ${cacheKey}`, result);
    } catch (err) {
      setError(err as Error);
      console.error(`❌ Force refetch error for ${cacheKey}:`, err);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, queryFn]);

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

// Utility to clear all cache
export const clearAllCache = () => {
  queryCache.clear();
};

// Utility to clear cache by pattern
export const clearCacheByPattern = (pattern: string) => {
  const keysToDelete: string[] = [];
  queryCache.forEach((_, key) => {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => queryCache.delete(key));
};