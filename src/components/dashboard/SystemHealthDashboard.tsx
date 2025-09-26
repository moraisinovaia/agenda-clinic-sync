import { useState, useEffect, useCallback } from 'react';
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

interface SystemHealthProps {
  doctors: any[];
  appointments: any[];
}

export const SystemHealthDashboard = ({ doctors, appointments }: SystemHealthProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'offline' | 'reconnecting'>('checking');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [connectionRetries, setConnectionRetries] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Função aprimorada de verificação de conexão com múltiplos testes
  const checkDatabaseConnection = useCallback(async () => {
    if (!isOnline) {
      setDbStatus('offline');
      setLastError('Sem conexão com a internet');
      return;
    }

    try {
      setDbStatus('checking');
      setLastError(null);
      logger.info('Verificando conexão com banco de dados', { tentativa: connectionRetries + 1 }, 'SYSTEM_HEALTH');
      
      // Teste 1: Verificar se consegue fazer uma query simples
      const { data: profilesTest, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (profilesError) {
        throw new Error(`Erro na consulta de profiles: ${profilesError.message}`);
      }

      // Teste 2: Verificar se consegue acessar médicos
      const { data: medicosTest, error: medicosError } = await supabase
        .from('medicos')
        .select('id')
        .limit(1);

      if (medicosError) {
        throw new Error(`Erro na consulta de médicos: ${medicosError.message}`);
      }

      // Teste 3: Verificar se consegue acessar agendamentos
      const { data: agendamentosTest, error: agendamentosError } = await supabase
        .from('agendamentos')
        .select('id')
        .limit(1);

      if (agendamentosError) {
        throw new Error(`Erro na consulta de agendamentos: ${agendamentosError.message}`);
      }

      setDbStatus('online');
      setConnectionRetries(0);
      setLastSync(new Date());
      logger.info('Conexão com banco de dados verificada com sucesso', {}, 'SYSTEM_HEALTH');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setLastError(errorMessage);
      setConnectionRetries(prev => prev + 1);
      
      logger.error('Falha na verificação de conectividade', { 
        error: errorMessage, 
        tentativa: connectionRetries + 1 
      }, 'SYSTEM_HEALTH');
      
      if (connectionRetries < 5) {
        setDbStatus('reconnecting');
        // Retry with exponential backoff
        const retryDelay = Math.pow(2, connectionRetries) * 1000;
        setTimeout(() => checkDatabaseConnection(), retryDelay);
      } else {
        setDbStatus('offline');
      }
    }
  }, [isOnline, connectionRetries]);

  // Função manual de reconexão
  const handleManualReconnect = useCallback(() => {
    setConnectionRetries(0);
    setDbStatus('checking');
    logger.info('Reconexão manual iniciada pelo usuário', {}, 'SYSTEM_HEALTH');
    checkDatabaseConnection();
  }, [checkDatabaseConnection]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('Conectividade de rede restaurada', {}, 'SYSTEM_HEALTH');
      checkDatabaseConnection();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('Conectividade de rede perdida', {}, 'SYSTEM_HEALTH');
      setDbStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkDatabaseConnection]);

  useEffect(() => {
    checkDatabaseConnection();
    
    const interval = setInterval(() => {
      if (dbStatus === 'online') {
        checkDatabaseConnection();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [checkDatabaseConnection, dbStatus]);

  const getHealthStatus = () => {
    if (!isOnline) return 'critical';
    if (dbStatus === 'offline') return 'critical';
    if (dbStatus === 'reconnecting' || dbStatus === 'checking') return 'warning';
    return 'healthy';
  };

  const getStatusText = () => {
    switch (dbStatus) {
      case 'online': return 'Conectado';
      case 'offline': return 'Desconectado';
      case 'checking': return 'Verificando...';
      case 'reconnecting': return 'Reconectando...';
      default: return 'Desconhecido';
    }
  };

  const healthStatus = getHealthStatus();
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(apt => apt.data_agendamento === today).length;
  const activeDoctors = doctors.filter(d => d.ativo).length;
  const occupationRate = activeDoctors > 0 ? Math.round((todayAppointments / (activeDoctors * 8)) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {healthStatus === 'healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : healthStatus === 'warning' ? (
                <RefreshCw className={`h-4 w-4 text-yellow-500 ${dbStatus === 'checking' || dbStatus === 'reconnecting' ? 'animate-spin' : ''}`} />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <Badge variant={
                healthStatus === 'healthy' ? 'default' : 
                healthStatus === 'warning' ? 'secondary' : 'destructive'
              }>
                {healthStatus === 'healthy' ? 'Saudável' : 
                 healthStatus === 'warning' ? 'Verificando' : 'Crítico'}
              </Badge>
            </div>
            
            {(dbStatus === 'offline' || dbStatus === 'reconnecting') && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleManualReconnect}
                disabled={dbStatus === 'reconnecting'}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${dbStatus === 'reconnecting' ? 'animate-spin' : ''}`} />
                Reconectar
              </Button>
            )}
          </div>
          
          <div className="mt-2 space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              {isOnline ? (
                <Wifi className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1 text-red-500" />
              )}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <div className={`h-2 w-2 rounded-full mr-1 ${
                dbStatus === 'online' ? 'bg-green-500' : 
                dbStatus === 'offline' ? 'bg-red-500' : 
                dbStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 'bg-yellow-500'
              }`} />
              DB: {getStatusText()}
              {connectionRetries > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (Tentativa {connectionRetries}/5)
                </span>
              )}
            </div>
            {lastError && (
              <div className="text-xs text-red-500 mt-1 truncate">
                Erro: {lastError}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ocupação Hoje</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{occupationRate}%</div>
          <Progress value={occupationRate} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {todayAppointments} agendamentos hoje
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Última sincronização:</span>
            <span>{lastSync.toLocaleTimeString('pt-BR')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};