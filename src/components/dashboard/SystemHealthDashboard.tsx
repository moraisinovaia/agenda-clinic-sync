import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Calendar,
  Database,
  Wifi
} from 'lucide-react';

interface SystemHealth {
  dbConnection: 'connected' | 'error' | 'checking';
  appointmentsToday: number;
  activeUsers: number;
  recentErrors: any[];
  lastUpdate: Date;
}

export function SystemHealthDashboard() {
  const [health, setHealth] = useState<SystemHealth>({
    dbConnection: 'checking',
    appointmentsToday: 0,
    activeUsers: 0,
    recentErrors: [],
    lastUpdate: new Date()
  });

  const checkSystemHealth = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Verificar conexão DB e buscar dados
      const [appointmentsResult, profilesResult] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('id, status')
          .eq('data_agendamento', today)
          .in('status', ['agendado', 'confirmado']),
        
        supabase
          .from('profiles')
          .select('id')
          .eq('ativo', true)
      ]);

      // Buscar erros recentes da auditoria (se existir)
      const auditResult = await supabase
        .from('agendamentos_audit')
        .select('*')
        .gte('changed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('changed_at', { ascending: false })
        .limit(10);

      setHealth({
        dbConnection: 'connected',
        appointmentsToday: appointmentsResult.data?.length || 0,
        activeUsers: profilesResult.data?.length || 0,
        recentErrors: auditResult.data || [],
        lastUpdate: new Date()
      });

    } catch (error) {
      console.error('Erro ao verificar saúde do sistema:', error);
      setHealth(prev => ({
        ...prev,
        dbConnection: 'error',
        lastUpdate: new Date()
      }));
    }
  };

  useEffect(() => {
    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 30000); // Check a cada 30s
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'checking':
        return <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'checking':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Saúde do Sistema
        </h3>
        <Badge variant="outline" className="text-xs">
          Última atualização: {health.lastUpdate.toLocaleTimeString()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status da Conexão */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Conexão DB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(health.dbConnection)}
              <Badge className={getStatusColor(health.dbConnection)}>
                {health.dbConnection === 'connected' && 'Conectado'}
                {health.dbConnection === 'error' && 'Erro'}
                {health.dbConnection === 'checking' && 'Verificando...'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Agendamentos Hoje */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Agendamentos Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {health.appointmentsToday}
            </div>
            <p className="text-xs text-muted-foreground">
              Agendados e confirmados
            </p>
          </CardContent>
        </Card>

        {/* Usuários Ativos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {health.activeUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Recepcionistas ativas
            </p>
          </CardContent>
        </Card>

        {/* Atividade Recente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {health.recentErrors.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Operações (24h)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas do Sistema */}
      {health.dbConnection === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Problema de conexão com o banco de dados. Verifique sua conexão de internet ou contate o suporte.
          </AlertDescription>
        </Alert>
      )}

      {health.appointmentsToday > 50 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Alto volume de agendamentos hoje ({health.appointmentsToday}). Monitore a capacidade da clínica.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}