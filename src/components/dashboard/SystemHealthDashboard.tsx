import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface SystemHealthProps {
  doctors: any[];
  appointments: any[];
}

export const SystemHealthDashboard = ({ doctors, appointments }: SystemHealthProps) => {
  const [isHealthy, setIsHealthy] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  
  // Calcular ocupação diária
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments?.filter(apt => 
    apt.data_agendamento === today && 
    apt.status !== 'cancelado'
  ) || [];
  
  const activeDoctors = doctors?.filter(doc => doc.ativo) || [];
  const occupationRate = activeDoctors.length > 0 
    ? Math.round((todayAppointments.length / (activeDoctors.length * 8)) * 100) // Assumindo 8 slots por médico
    : 0;

  const getHealthStatus = () => {
    if (!isHealthy) return { status: 'critical', color: 'text-red-500', bg: 'bg-red-50' };
    if (occupationRate > 80) return { status: 'warning', color: 'text-yellow-500', bg: 'bg-yellow-50' };
    return { status: 'healthy', color: 'text-green-500', bg: 'bg-green-50' };
  };

  const healthStatus = getHealthStatus();

  const forceHealthCheck = async () => {
    try {
      const { error } = await supabase.from('medicos').select('count').limit(1);
      setIsHealthy(!error);
      setLastCheck(new Date());
    } catch (error) {
      setIsHealthy(false);
      setLastCheck(new Date());
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            {healthStatus.status === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : healthStatus.status === 'warning' ? (
              <Clock className="h-4 w-4 text-yellow-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <Badge variant={healthStatus.status === 'healthy' ? 'default' : healthStatus.status === 'warning' ? 'secondary' : 'destructive'}>
              {healthStatus.status === 'healthy' ? 'Saudável' : healthStatus.status === 'warning' ? 'Verificando' : 'Crítico'}
            </Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              {isHealthy ? (
                <Wifi className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1 text-red-500" />
              )}
              {isHealthy ? 'Online' : 'Offline'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Database className={`h-3 w-3 mr-1 ${
                isHealthy ? 'text-green-500' : 'text-red-500'
              }`} />
              DB: {isHealthy ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
          {!isHealthy && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={forceHealthCheck} 
              className="mt-2 w-full"
            >
              Tentar Reconectar
            </Button>
          )}
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
            <span>Última verificação:</span>
            <span>{lastCheck.toLocaleTimeString('pt-BR')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};