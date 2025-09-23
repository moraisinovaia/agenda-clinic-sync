import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Users, 
  Calendar,
  UserCheck,
  Clock
} from 'lucide-react';

interface ClientData {
  id: string;
  nome: string;
  ativo: boolean;
  stats: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    totalAppointments: number;
    activeDoctors: number;
    totalPatients: number;
  };
}

interface ClientHealthMonitorProps {
  clientsData: ClientData[];
  selectedClient: string | null;
}

export const ClientHealthMonitor = ({ 
  clientsData, 
  selectedClient 
}: ClientHealthMonitorProps) => {
  const filteredClients = selectedClient 
    ? clientsData.filter(c => c.id === selectedClient)
    : clientsData;

  const getHealthStatus = (client: ClientData) => {
    const issues = [];
    
    if (!client.ativo) {
      issues.push({ type: 'critical', message: 'Cliente inativo' });
    }
    
    if (client.stats.activeDoctors === 0) {
      issues.push({ type: 'critical', message: 'Nenhum médico ativo' });
    }
    
    if (client.stats.pendingUsers > 0) {
      issues.push({ 
        type: 'warning', 
        message: `${client.stats.pendingUsers} usuário(s) pendente(s)` 
      });
    }
    
    if (client.stats.totalUsers > 0 && client.stats.activeUsers / client.stats.totalUsers < 0.5) {
      issues.push({ 
        type: 'warning', 
        message: 'Baixa taxa de usuários ativos' 
      });
    }

    return {
      status: issues.some(i => i.type === 'critical') ? 'critical' : 
              issues.some(i => i.type === 'warning') ? 'warning' : 'healthy',
      issues
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {filteredClients.map((client) => {
        const health = getHealthStatus(client);
        const userActivityRate = client.stats.totalUsers > 0 
          ? (client.stats.activeUsers / client.stats.totalUsers) * 100 
          : 0;

        return (
          <Card key={client.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(health.status)}
                  <span>{client.nome}</span>
                </div>
                <Badge 
                  variant={
                    health.status === 'healthy' ? 'default' :
                    health.status === 'warning' ? 'secondary' :
                    'destructive'
                  }
                >
                  {health.status === 'healthy' ? 'Saudável' :
                   health.status === 'warning' ? 'Atenção' :
                   'Crítico'}
                </Badge>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Health Issues */}
              {health.issues.length > 0 && (
                <div className="space-y-2">
                  {health.issues.map((issue, index) => (
                    <Alert 
                      key={index}
                      variant={issue.type === 'critical' ? 'destructive' : 'default'}
                    >
                      {issue.type === 'critical' ? 
                        <XCircle className="h-4 w-4" /> : 
                        <AlertTriangle className="h-4 w-4" />
                      }
                      <AlertDescription>{issue.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
              
              {/* Health Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Activity */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Atividade de Usuários</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {client.stats.activeUsers}/{client.stats.totalUsers}
                    </span>
                  </div>
                  <Progress value={userActivityRate} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {userActivityRate.toFixed(1)}% dos usuários estão ativos
                  </p>
                </div>

                {/* Doctors Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Médicos Ativos</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {client.stats.activeDoctors}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.stats.activeDoctors > 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {client.stats.activeDoctors > 0 
                        ? 'Sistema operacional' 
                        : 'Sem médicos ativos'}
                    </span>
                  </div>
                </div>

                {/* Appointments Volume */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Volume de Agendamentos</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {client.stats.totalAppointments}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.stats.totalAppointments > 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {client.stats.totalAppointments > 0 
                        ? 'Agendamentos registrados' 
                        : 'Nenhum agendamento'}
                    </span>
                  </div>
                </div>

                {/* Pending Actions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Ações Pendentes</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {client.stats.pendingUsers}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.stats.pendingUsers === 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {client.stats.pendingUsers === 0 
                        ? 'Todas as aprovações em dia' 
                        : `${client.stats.pendingUsers} usuário(s) aguardando aprovação`}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};