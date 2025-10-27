import { useCallback, useEffect, useState, useRef } from 'react';
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
  const [isRetrying, setIsRetrying] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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

      const now = Date.now();

      // ✅ NUNCA usar cache quando cacheTime === 0
      if (cacheTime === 0) {
        console.log(`🚫 Cache desabilitado (cacheTime=0): ${cacheKey} - Executando query direta`);
        const result = await queryFn();
        setData(result);
        setLoading(false);
        return;
      }

      // Check cache first (apenas se cacheTime > 0)
      const cached = queryCache.get(cacheKey);

      if (cached && (now - cached.timestamp) < cacheTime) {
        console.log(`✅ Usando cache: ${cacheKey}`);
        setData(cached.data);
        setLoading(false);
        
        // If data is stale but not expired, return cached and refetch in background
        if ((now - cached.timestamp) > staleTime) {
          queryFn().then(freshData => {
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
      console.log(`🔄 Cache miss ou expirado: ${cacheKey} - Executando query`);
      const result = await queryFn();
      
      // Cache the result (apenas se cacheTime > 0)
      if (cacheTime > 0) {
        queryCache.set(cacheKey, {
          data: result,
          timestamp: now,
          isStale: false
        });
      }

      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Query error:', err);
    } finally {
      setLoading(false);
    }
  }, [queryFn, cacheKey, cacheTime, staleTime]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading: loading || isRetrying,
    error,
    refetch,
    invalidateCache,
    forceRefetch
  };
};

// Utility to clear all cache
export const clearAllCache = () => {
  const size = queryCache.size;
  queryCache.clear();
  console.log(`🧹 Todos os ${size} caches foram limpos`);
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
  console.log(`🧹 ${keysToDelete.length} caches com padrão "${pattern}" foram limpos`);
};
