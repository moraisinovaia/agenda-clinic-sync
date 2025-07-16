import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/utils/logger';

interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
}

interface ApiMetrics {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
}

export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});
  const [apiMetrics, setApiMetrics] = useState<ApiMetrics[]>([]);

  // Coletar métricas Web Vitals
  useEffect(() => {
    // Performance Observer para métricas
    if ('PerformanceObserver' in window) {
      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcp) {
          setMetrics(prev => ({ ...prev, firstContentfulPaint: fcp.startTime }));
          logger.performance.measure('First Contentful Paint', fcp.startTime);
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          setMetrics(prev => ({ ...prev, largestContentfulPaint: lastEntry.startTime }));
          logger.performance.measure('Largest Contentful Paint', lastEntry.startTime);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      // First Input Delay
      const fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          const fid = entry.processingStart - entry.startTime;
          setMetrics(prev => ({ ...prev, firstInputDelay: fid }));
          logger.performance.measure('First Input Delay', fid);
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            setMetrics(prev => ({ ...prev, cumulativeLayoutShift: clsValue }));
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      return () => {
        fcpObserver.disconnect();
        lcpObserver.disconnect();
        fidObserver.disconnect();
        clsObserver.disconnect();
      };
    }

    // Page Load Time
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      setMetrics(prev => ({ ...prev, pageLoadTime: loadTime }));
      logger.performance.measure('Page Load Time', loadTime);
    });
  }, []);

  // Interceptar requisições para medir performance de API
  const measureApiCall = useCallback(<T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> => {
    const startTime = performance.now();
    
    return apiCall()
      .then((result) => {
        const duration = performance.now() - startTime;
        const metric: ApiMetrics = {
          endpoint,
          method,
          duration,
          status: 200,
          timestamp: Date.now()
        };
        
        setApiMetrics(prev => [...prev.slice(-99), metric]); // Manter apenas os 100 mais recentes
        
        if (duration > 1000) { // Log apenas queries lentas (>1s)
          logger.performance.slowQuery(endpoint, duration);
        }
        
        return result;
      })
      .catch((error) => {
        const duration = performance.now() - startTime;
        const metric: ApiMetrics = {
          endpoint,
          method,
          duration,
          status: error.status || 500,
          timestamp: Date.now()
        };
        
        setApiMetrics(prev => [...prev.slice(-99), metric]);
        logger.error(`API Error: ${endpoint}`, error, 'API_PERFORMANCE');
        
        throw error;
      });
  }, []);

  // Calcular estatísticas de API
  const getApiStats = useCallback(() => {
    if (apiMetrics.length === 0) return null;

    const durations = apiMetrics.map(m => m.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    const errorRate = (apiMetrics.filter(m => m.status >= 400).length / apiMetrics.length) * 100;

    return {
      avgDuration,
      maxDuration,
      minDuration,
      errorRate,
      totalRequests: apiMetrics.length
    };
  }, [apiMetrics]);

  // Reportar métricas periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getApiStats();
      if (stats && stats.totalRequests > 0) {
        logger.performance.measure('API Stats Report', stats);
      }
    }, 60000); // A cada minuto

    return () => clearInterval(interval);
  }, [getApiStats]);

  return {
    metrics,
    apiMetrics,
    measureApiCall,
    getApiStats: getApiStats()
  };
};