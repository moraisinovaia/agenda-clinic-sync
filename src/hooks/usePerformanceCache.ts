import { useState, useRef, useCallback } from 'react';
import { logger } from '@/utils/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxItems: number;
  maxAge: number; // milliseconds
  maxMemoryMB: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxItems: 1000,
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxMemoryMB: 50, // 50MB limit
};

export function usePerformanceCache<T>(config: Partial<CacheConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const cache = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    size: 0,
    memoryUsageMB: 0,
  });

  // Estimate memory usage of an object
  const estimateMemoryUsage = useCallback((obj: any): number => {
    const jsonStr = JSON.stringify(obj);
    return jsonStr.length * 2; // Rough estimate: 2 bytes per character
  }, []);

  // Get current memory usage
  const getCurrentMemoryUsage = useCallback((): number => {
    let totalBytes = 0;
    cache.current.forEach((entry) => {
      totalBytes += estimateMemoryUsage(entry.data);
    });
    return totalBytes / (1024 * 1024); // Convert to MB
  }, [estimateMemoryUsage]);

  // LRU eviction policy
  const evictLRU = useCallback(() => {
    let oldestKey = '';
    let oldestTime = Date.now();

    cache.current.forEach((entry, key) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      cache.current.delete(oldestKey);
      logger.info('Cache eviction (LRU)', { evictedKey: oldestKey }, 'CACHE');
    }
  }, []);

  // Clean expired entries
  const cleanExpired = useCallback(() => {
    const now = Date.now();
    const expiredKeys: string[] = [];

    cache.current.forEach((entry, key) => {
      if (now - entry.timestamp > finalConfig.maxAge) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      cache.current.delete(key);
    });

    if (expiredKeys.length > 0) {
      logger.info('Cache cleanup', { expiredCount: expiredKeys.length }, 'CACHE');
    }
  }, [finalConfig.maxAge]);

  // Enforce cache limits
  const enforceConstraints = useCallback(() => {
    // Clean expired first
    cleanExpired();

    // Check memory limit
    const memoryUsage = getCurrentMemoryUsage();
    while (memoryUsage > finalConfig.maxMemoryMB && cache.current.size > 0) {
      evictLRU();
    }

    // Check item count limit
    while (cache.current.size > finalConfig.maxItems) {
      evictLRU();
    }

    // Update stats
    setCacheStats(prev => ({
      ...prev,
      size: cache.current.size,
      memoryUsageMB: getCurrentMemoryUsage(),
    }));
  }, [cleanExpired, getCurrentMemoryUsage, evictLRU, finalConfig.maxMemoryMB, finalConfig.maxItems]);

  // Set cache entry
  const set = useCallback((key: string, data: T) => {
    const now = Date.now();
    
    cache.current.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    });

    enforceConstraints();

    logger.info('Cache set', { 
      key, 
      cacheSize: cache.current.size,
      memoryUsage: `${getCurrentMemoryUsage().toFixed(2)}MB`
    }, 'CACHE');
  }, [enforceConstraints, getCurrentMemoryUsage]);

  // Get cache entry
  const get = useCallback((key: string): T | null => {
    const entry = cache.current.get(key);
    
    if (!entry) {
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > finalConfig.maxAge) {
      cache.current.delete(key);
      setCacheStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    // Update access stats
    entry.lastAccessed = now;
    entry.accessCount++;

    setCacheStats(prev => ({ ...prev, hits: prev.hits + 1 }));
    
    return entry.data;
  }, [finalConfig.maxAge]);

  // Check if key exists and is valid
  const has = useCallback((key: string): boolean => {
    const entry = cache.current.get(key);
    
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > finalConfig.maxAge) {
      cache.current.delete(key);
      return false;
    }

    return true;
  }, [finalConfig.maxAge]);

  // Delete specific key
  const del = useCallback((key: string): boolean => {
    const result = cache.current.delete(key);
    setCacheStats(prev => ({
      ...prev,
      size: cache.current.size,
      memoryUsageMB: getCurrentMemoryUsage(),
    }));
    return result;
  }, [getCurrentMemoryUsage]);

  // Clear all cache
  const clear = useCallback(() => {
    const previousSize = cache.current.size;
    cache.current.clear();
    
    setCacheStats({
      hits: 0,
      misses: 0,
      size: 0,
      memoryUsageMB: 0,
    });

    logger.info('Cache cleared', { previousSize }, 'CACHE');
  }, []);

  // Get cache statistics
  const getStats = useCallback(() => {
    const hitRate = cacheStats.hits + cacheStats.misses > 0 
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...cacheStats,
      hitRate: `${hitRate}%`,
      memoryUsageMB: getCurrentMemoryUsage(),
    };
  }, [cacheStats, getCurrentMemoryUsage]);

  // Get top accessed items
  const getTopItems = useCallback((limit: number = 10) => {
    const items = Array.from(cache.current.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccessed: new Date(entry.lastAccessed).toISOString(),
        age: Date.now() - entry.timestamp,
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);

    return items;
  }, []);

  return {
    // Core cache operations
    set,
    get,
    has,
    del,
    clear,
    
    // Utilities
    getStats,
    getTopItems,
    enforceConstraints,
    
    // Current stats
    stats: cacheStats,
  };
}