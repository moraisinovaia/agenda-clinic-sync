import { Building2, Users, Activity, AlertTriangle, Calendar, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface SuperAdminStatsProps {
  clientsData: ClientData[];
}

export const SuperAdminStats = ({ clientsData }: SuperAdminStatsProps) => {
  const totalStats = clientsData.reduce((acc, client) => ({
    totalClients: acc.totalClients + 1,
    activeClients: acc.activeClients + (client.ativo ? 1 : 0),
    totalUsers: acc.totalUsers + client.stats.totalUsers,
    activeUsers: acc.activeUsers + client.stats.activeUsers,
    pendingUsers: acc.pendingUsers + client.stats.pendingUsers,
    totalAppointments: acc.totalAppointments + client.stats.totalAppointments,
    activeDoctors: acc.activeDoctors + client.stats.activeDoctors,
    totalPatients: acc.totalPatients + client.stats.totalPatients,
  }), {
    totalClients: 0,
    activeClients: 0,
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalAppointments: 0,
    activeDoctors: 0,
    totalPatients: 0,
  });

  const criticalIssues = clientsData.filter(c => 
    !c.ativo || 
    c.stats.pendingUsers > 0 || 
    c.stats.activeDoctors === 0
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
      {/* Total Clients */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-bold">{totalStats.totalClients}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-xs text-green-600">{totalStats.activeClients} ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Users */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-500" />
            <div>
              <p className="text-lg font-bold">{totalStats.totalUsers}</p>
              <p className="text-xs text-muted-foreground">Usuários</p>
              <p className="text-xs text-green-600">{totalStats.activeUsers} ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-lg font-bold">{totalStats.totalAppointments}</p>
              <p className="text-xs text-muted-foreground">Agendamentos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Doctors */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-purple-500" />
            <div>
              <p className="text-lg font-bold">{totalStats.activeDoctors}</p>
              <p className="text-xs text-muted-foreground">Médicos Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Users */}
      <Card>
        <CardContent className="p-4">  
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <div>
              <p className="text-lg font-bold">{totalStats.pendingUsers}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              {totalStats.pendingUsers > 0 && (
                <Badge variant="secondary" className="text-xs mt-1">
                  Requer ação
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-red-500" />
            <div>
              <p className="text-lg font-bold">{criticalIssues}</p>
              <p className="text-xs text-muted-foreground">Problemas</p>
              {criticalIssues === 0 ? (
                <Badge variant="default" className="text-xs mt-1">
                  Saudável
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs mt-1">
                  Atenção
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};