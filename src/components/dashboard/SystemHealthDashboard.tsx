import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface SystemHealthProps {
  doctors: any[];
  appointments: any[];
}

export const SystemHealthDashboard = ({ doctors, appointments }: SystemHealthProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    checkDatabaseConnection();
    
    const interval = setInterval(() => {
      checkDatabaseConnection();
      setLastSync(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkDatabaseConnection = async () => {
    try {
      setDbStatus('checking');
      await supabase.from('profiles').select('id').limit(1);
      setDbStatus('online');
    } catch (error) {
      setDbStatus('offline');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(apt => apt.data_agendamento === today).length;
  const activeDoctors = doctors.filter(d => d.ativo).length;
  const occupationRate = activeDoctors > 0 ? Math.round((todayAppointments / (activeDoctors * 8)) * 100) : 0;

  const getHealthStatus = () => {
    if (!isOnline || dbStatus === 'offline') return 'critical';
    return 'healthy';
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            {healthStatus === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <Badge variant={healthStatus === 'healthy' ? 'default' : 'destructive'}>
              {healthStatus === 'healthy' ? 'Saudável' : 'Crítico'}
            </Badge>
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
                dbStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              DB: {dbStatus === 'online' ? 'Conectado' : 
                   dbStatus === 'offline' ? 'Desconectado' : 'Verificando...'}
            </div>
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