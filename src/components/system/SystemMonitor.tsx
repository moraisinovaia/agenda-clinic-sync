import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Database, DatabaseZap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAlertSystem } from '@/hooks/useAlertSystem';

interface SystemStatus {
  isOnline: boolean;
  databaseConnected: boolean;
  lastUpdate: Date;
  responseTime: number;
}

export const SystemMonitor = () => {
  const { sendDatabaseIssueAlert, sendSystemDownAlert } = useAlertSystem();
  const [status, setStatus] = useState<SystemStatus>({
    isOnline: navigator.onLine,
    databaseConnected: false,
    lastUpdate: new Date(),
    responseTime: 0
  });

  const checkDatabaseConnection = async () => {
    const startTime = Date.now();
    try {
      // Teste simples de conectividade com a base de dados
      const { error } = await supabase
        .from('medicos')
        .select('id')
        .limit(1);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      const wasConnected = status.databaseConnected;
      const isNowConnected = !error;

      // Enviar alerta se o status mudou de conectado para desconectado
      if (wasConnected && !isNowConnected && error) {
        await sendDatabaseIssueAlert(error);
      }

      setStatus(prev => ({
        ...prev,
        databaseConnected: isNowConnected,
        responseTime,
        lastUpdate: new Date()
      }));
    } catch (error) {
      const wasConnected = status.databaseConnected;
      
      // Enviar alerta se estava conectado e agora não está
      if (wasConnected) {
        await sendSystemDownAlert({ error });
      }

      setStatus(prev => ({
        ...prev,
        databaseConnected: false,
        responseTime: 0,
        lastUpdate: new Date()
      }));
    }
  };

  useEffect(() => {
    // Check database connection immediately
    checkDatabaseConnection();

    // Setup periodic health checks
    const interval = setInterval(checkDatabaseConnection, 30000); // Every 30 seconds
    
    // Check connectivity every 5 minutes for proactive monitoring
    const healthInterval = setInterval(async () => {
      try {
        const response = await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' });
        setStatus(prev => ({ ...prev, isOnline: true }));
      } catch {
        setStatus(prev => ({ ...prev, isOnline: false }));
      }
    }, 5 * 60 * 1000);

    // Listen for online/offline events
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = (): "default" | "destructive" | "secondary" | "outline" => {
    if (!status.isOnline || !status.databaseConnected) return 'destructive';
    if (status.responseTime > 2000) return 'secondary';
    return 'default';
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (!status.databaseConnected) return 'Erro de Conexão';
    if (status.responseTime > 2000) return 'Lento';
    return 'Online';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {status.isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          Status do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Conexão</span>
          <Badge variant={getStatusColor() as any}>
            {getStatusText()}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Banco de Dados</span>
          <div className="flex items-center gap-1">
            {status.databaseConnected ? (
              <Database className="h-3 w-3 text-green-500" />
            ) : (
              <DatabaseZap className="h-3 w-3 text-red-500" />
            )}
            <Badge variant={status.databaseConnected ? 'default' : 'destructive'}>
              {status.databaseConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        </div>

        {status.databaseConnected && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Latência</span>
            <Badge variant={status.responseTime > 2000 ? 'secondary' : 'default'}>
              {status.responseTime}ms
            </Badge>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Última verificação: {status.lastUpdate.toLocaleTimeString('pt-BR')}
        </div>
      </CardContent>
    </Card>
  );
};