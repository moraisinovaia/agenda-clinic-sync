import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { logger } from '@/utils/logger';
import { 
  Shield, 
  Database, 
  Activity, 
  HardDrive, 
  Users, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Download,
  RefreshCw
} from 'lucide-react';

interface SystemMetrics {
  totalUsers: number;
  totalAppointments: number;
  todayAppointments: number;
  activePatients: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  context?: string;
}

export const SystemMonitorDashboard = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { getApiStats } = usePerformanceMetrics();

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    try {
      setLoading(true);
      
      // Carregar métricas do sistema
      const [usersCount, appointmentsCount, todayAppts, patientsCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('agendamentos').select('id', { count: 'exact' }),
        supabase.from('agendamentos')
          .select('id', { count: 'exact' })
          .eq('data_agendamento', new Date().toISOString().split('T')[0]),
        supabase.from('pacientes').select('id', { count: 'exact' })
      ]);

      setMetrics({
        totalUsers: usersCount.count || 0,
        totalAppointments: appointmentsCount.count || 0,
        todayAppointments: todayAppts.count || 0,
        activePatients: patientsCount.count || 0,
        systemHealth: 'good'
      });

      // Carregar logs recentes
      const { data: logsData } = await supabase.functions.invoke('system-logs', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (logsData?.logs) {
        setLogs(logsData.logs.slice(0, 10));
      }

      // Carregar backups
      const { data: backupsData } = await supabase.functions.invoke('backup-system/list');
      if (backupsData?.backups) {
        setBackups(backupsData.backups.slice(0, 5));
      }

    } catch (error) {
      logger.error('Erro ao carregar dados do sistema', error, 'SYSTEM_MONITOR');
      toast({
        title: "Erro",
        description: "Falha ao carregar dados do sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    try {
      const { data } = await supabase.functions.invoke('backup-system/create', {
        method: 'POST',
        body: JSON.stringify({
          includeData: true,
          includeSchema: true,
          tables: ['agendamentos', 'pacientes', 'medicos', 'atendimentos', 'profiles']
        })
      });

      if (data?.success) {
        toast({
          title: "Backup criado",
          description: "Backup do sistema criado com sucesso",
        });
        loadSystemData(); // Recarregar dados
      }
    } catch (error) {
      logger.error('Erro ao criar backup', error, 'BACKUP');
      toast({
        title: "Erro",
        description: "Falha ao criar backup",
        variant: "destructive",
      });
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthProgress = (health: string) => {
    switch (health) {
      case 'excellent': return 100;
      case 'good': return 80;
      case 'warning': return 60;
      case 'critical': return 30;
      default: return 50;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitor do Sistema</h1>
          <p className="text-muted-foreground">
            Acompanhamento em tempo real da saúde e performance do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createBackup} variant="outline">
            <HardDrive className="h-4 w-4 mr-2" />
            Criar Backup
          </Button>
          <Button onClick={loadSystemData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos Total</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalAppointments || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.todayAppointments || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pacientes Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activePatients || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Saúde do sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Saúde do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Status Geral</span>
              <Badge className={getHealthColor(metrics?.systemHealth || 'good')}>
                {metrics?.systemHealth || 'good'}
              </Badge>
            </div>
            <Progress 
              value={getHealthProgress(metrics?.systemHealth || 'good')} 
              className="h-2"
            />
            
            {getApiStats && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tempo Médio API</p>
                  <p className="font-semibold">{getApiStats.avgDuration?.toFixed(0)}ms</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Taxa de Erro</p>
                  <p className="font-semibold">{getApiStats.errorRate?.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Requests</p>
                  <p className="font-semibold">{getApiStats.totalRequests}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Max Duration</p>
                  <p className="font-semibold">{getApiStats.maxDuration?.toFixed(0)}ms</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Logs do Sistema</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs Recentes</CardTitle>
              <CardDescription>
                Últimas atividades do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {log.level === 'error' ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{log.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={log.level === 'error' ? 'destructive' : 'default'}>
                      {log.level}
                    </Badge>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum log encontrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups">
          <Card>
            <CardHeader>
              <CardTitle>Backups do Sistema</CardTitle>
              <CardDescription>
                Histórico de backups e restore points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">
                          Backup - {backup.table_count} tabelas
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(backup.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={backup.status === 'completed' ? 'default' : 'destructive'}>
                        {backup.status}
                      </Badge>
                      <Button size="sm" variant="outline">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {backups.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum backup encontrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
              <CardDescription>
                Monitoramento em tempo real da performance da aplicação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Activity className="h-4 w-4" />
                <AlertDescription>
                  Sistema de monitoramento ativo. Métricas sendo coletadas em tempo real.
                  {getApiStats && (
                    <span className="block mt-2">
                      Performance atual: {getApiStats.avgDuration?.toFixed(0)}ms de tempo médio de resposta
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};