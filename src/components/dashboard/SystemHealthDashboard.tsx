import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';

interface SystemHealthProps {
  doctors: any[];
  appointments: any[];
}

export const SystemHealthDashboard = ({ doctors, appointments }: SystemHealthProps) => {
  const connectionHealth = useConnectionHealth();
  
  console.log('🏥 SystemHealthDashboard - Connection:', connectionHealth.dbStatus, 'Online:', connectionHealth.isOnline);

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(apt => apt.data_agendamento === today).length;
  const activeDoctors = doctors.filter(d => d.ativo).length;
  const occupationRate = activeDoctors > 0 ? Math.round((todayAppointments / (activeDoctors * 8)) * 100) : 0;

  const getHealthStatus = () => {
    if (!connectionHealth.isOnline || connectionHealth.dbStatus === 'disconnected') return 'critical';
    if (connectionHealth.dbStatus === 'checking') return 'warning';
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
            ) : healthStatus === 'warning' ? (
              <Clock className="h-4 w-4 text-yellow-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <Badge variant={healthStatus === 'healthy' ? 'default' : healthStatus === 'warning' ? 'secondary' : 'destructive'}>
              {healthStatus === 'healthy' ? 'Saudável' : healthStatus === 'warning' ? 'Verificando' : 'Crítico'}
            </Badge>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center text-xs text-muted-foreground">
              {connectionHealth.isOnline ? (
                <Wifi className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1 text-red-500" />
              )}
              {connectionHealth.isOnline ? 'Online' : 'Offline'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Database className={`h-3 w-3 mr-1 ${
                connectionHealth.dbStatus === 'connected' ? 'text-green-500' : 
                connectionHealth.dbStatus === 'disconnected' ? 'text-red-500' : 'text-yellow-500'
              }`} />
              DB: {connectionHealth.dbStatus === 'connected' ? 'Conectado' : 
                   connectionHealth.dbStatus === 'disconnected' ? 'Desconectado' : 'Verificando...'}
            </div>
            {connectionHealth.errorCount > 0 && (
              <div className="text-xs text-yellow-600">
                Erros: {connectionHealth.errorCount}
              </div>
            )}
          </div>
          {connectionHealth.dbStatus === 'disconnected' && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => connectionHealth.forceCheck()} 
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
            <span>{connectionHealth.lastCheck.toLocaleTimeString('pt-BR')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};