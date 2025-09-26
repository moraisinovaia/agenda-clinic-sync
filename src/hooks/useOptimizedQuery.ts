import { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface QueryOptions {
  cacheKey: string;
  cacheTime?: number; // in milliseconds
  staleTime?: number; // in milliseconds
  refetchOnMount?: boolean;
  maxRetries?: number;
  retryDelay?: number;
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
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    cacheKey,
    cacheTime = 5 * 60 * 1000, // 5 minutes default
    staleTime = 30 * 1000, // 30 seconds default
    refetchOnMount = true,
    maxRetries = 3,
    retryDelay = 1000
  } = options;

  // Retry function with exponential backoff
  const executeWithRetry = useCallback(async (fn: () => Promise<T>, retries = 0): Promise<T> => {
    try {
      const result = await fn();
      setRetryCount(0); // Reset on success
      return result;
    } catch (err) {
      logger.error(`Tentativa ${retries + 1} falhou para ${cacheKey}`, err, 'OPTIMIZED_QUERY');
      
      if (retries < maxRetries) {
        setIsRetrying(true);
        setRetryCount(retries + 1);
        
        const delay = retryDelay * Math.pow(2, retries); // Exponential backoff
        logger.info(`Tentando novamente em ${delay}ms para ${cacheKey}`, {}, 'OPTIMIZED_QUERY');
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeWithRetry(fn, retries + 1);
      }
      
      setIsRetrying(false);
      throw err;
    }
  }, [cacheKey, maxRetries, retryDelay]);

  const executeQuery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsRetrying(false);

      // Check cache first
      const cached = queryCache.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < cacheTime) {
        setData(cached.data);
        setLoading(false);
        
        // If data is stale but not expired, return cached and refetch in background
        if ((now - cached.timestamp) > staleTime) {
          executeWithRetry(queryFn).then(freshData => {
            queryCache.set(cacheKey, {
              data: freshData,
              timestamp: now,
              isStale: false
            });
            setData(freshData);
            logger.info(`Background refresh concluído para ${cacheKey}`, {}, 'OPTIMIZED_QUERY');
          }).catch(err => {
            logger.warn(`Background refresh falhou para ${cacheKey}`, err, 'OPTIMIZED_QUERY');
          });
        }
        return;
      }

      // Execute fresh query with retry
      const result = await executeWithRetry(queryFn);
      
      // Cache the result
      queryCache.set(cacheKey, {
        data: result,
        timestamp: now,
        isStale: false
      });

      setData(result);
      logger.info(`Query executada com sucesso para ${cacheKey}`, {}, 'OPTIMIZED_QUERY');
    } catch (err) {
      setError(err as Error);
      logger.error(`Query falhou completamente para ${cacheKey}`, err, 'OPTIMIZED_QUERY');
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [queryFn, cacheKey, cacheTime, staleTime, executeWithRetry]);

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
    logger.info(`Force refetching iniciado para ${cacheKey}`, {}, 'OPTIMIZED_QUERY');
    
    try {
      setLoading(true);
      setError(null);
      setIsRetrying(false);
      
      const result = await executeWithRetry(queryFn);
      const now = Date.now();
      
      queryCache.set(cacheKey, {
        data: result,
        timestamp: now,
        isStale: false
      });
      
      setData(result);
      logger.info(`Force refetch concluído com sucesso para ${cacheKey}`, {}, 'OPTIMIZED_QUERY');
    } catch (err) {
      setError(err as Error);
      logger.error(`Force refetch falhou para ${cacheKey}`, err, 'OPTIMIZED_QUERY');
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [cacheKey, executeWithRetry]);

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
    retryCount,
    isRetrying,
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