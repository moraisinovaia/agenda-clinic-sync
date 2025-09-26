import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectionHealth {
  isOnline: boolean;
  dbStatus: 'checking' | 'connected' | 'disconnected';
  lastCheck: Date;
  errorCount: number;
}

export function useConnectionHealth() {
  const [health, setHealth] = useState<ConnectionHealth>({
    isOnline: navigator.onLine,
    dbStatus: 'checking',
    lastCheck: new Date(),
    errorCount: 0
  });

  const checkDatabaseConnection = useCallback(async () => {
    try {
      console.log('🏥 Verificando saúde da conexão...');
      setHealth(prev => ({ ...prev, dbStatus: 'checking' }));
      
      // Simple query to test connectivity
      await supabase.from('profiles').select('id').limit(1);
      
      console.log('✅ Conexão com banco saudável');
      setHealth(prev => ({
        ...prev,
        dbStatus: 'connected',
        lastCheck: new Date(),
        errorCount: 0
      }));
      
      return true;
    } catch (error: any) {
      console.error('❌ Erro na conexão com banco:', error);
      setHealth(prev => ({
        ...prev,
        dbStatus: 'disconnected',
        lastCheck: new Date(),
        errorCount: prev.errorCount + 1
      }));
      
      return false;
    }
  }, []);

  // Monitor online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('📡 Conexão restaurada');
      setHealth(prev => ({ ...prev, isOnline: true }));
      checkDatabaseConnection();
    };
    
    const handleOffline = () => {
      console.log('📴 Conexão perdida');
      setHealth(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkDatabaseConnection]);

  // Initial check and periodic health checks
  useEffect(() => {
    checkDatabaseConnection();
    
    // Check every 30 seconds, but with exponential backoff on errors
    const interval = setInterval(() => {
      const timeSinceLastCheck = Date.now() - health.lastCheck.getTime();
      const minInterval = Math.min(30000, Math.max(5000, health.errorCount * 5000));
      
      if (timeSinceLastCheck >= minInterval) {
        checkDatabaseConnection();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [checkDatabaseConnection, health.lastCheck, health.errorCount]);

  const forceCheck = useCallback(() => {
    return checkDatabaseConnection();
  }, [checkDatabaseConnection]);

  return {
    ...health,
    isHealthy: health.isOnline && health.dbStatus === 'connected',
    forceCheck
  };
}