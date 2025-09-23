import { useState } from 'react';
import { Building2, Users, Calendar, UserCheck, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface ClientData {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  stats: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    totalAppointments: number;
    activeDoctors: number;
    totalPatients: number;
  };
}

interface ClientOverviewProps {
  clientsData: ClientData[];
  selectedClient: string | null;
  onClientSelect: (clientId: string | null) => void;
}

export const ClientOverview = ({ 
  clientsData, 
  selectedClient, 
  onClientSelect 
}: ClientOverviewProps) => {
  const filteredClients = selectedClient 
    ? clientsData.filter(c => c.id === selectedClient)
    : clientsData;

  const totalStats = clientsData.reduce((acc, client) => ({
    totalUsers: acc.totalUsers + client.stats.totalUsers,
    activeUsers: acc.activeUsers + client.stats.activeUsers,
    pendingUsers: acc.pendingUsers + client.stats.pendingUsers,
    totalAppointments: acc.totalAppointments + client.stats.totalAppointments,
    activeDoctors: acc.activeDoctors + client.stats.activeDoctors,
    totalPatients: acc.totalPatients + client.stats.totalPatients,
  }), {
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalAppointments: 0,
    activeDoctors: 0,
    totalPatients: 0,
  });

  return (
    <div className="space-y-6">
      {!selectedClient && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{clientsData.length}</p>
                  <p className="text-sm text-muted-foreground">Clientes Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{totalStats.totalUsers}</p>
                  <p className="text-sm text-muted-foreground">Usuários Total</p>
                  <p className="text-xs text-green-600">{totalStats.activeUsers} ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{totalStats.totalAppointments}</p>
                  <p className="text-sm text-muted-foreground">Agendamentos Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{totalStats.activeDoctors}</p>
                  <p className="text-sm text-muted-foreground">Médicos Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6">
        {filteredClients.map((client) => (
          <Card key={client.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle className="text-xl">{client.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Cliente desde {new Date(client.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {client.ativo ? (
                    <Badge variant="default">Ativo</Badge>
                  ) : (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                  {client.stats.pendingUsers > 0 && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {client.stats.pendingUsers} pendentes
                    </Badge>
                  )}
                  {selectedClient !== client.id && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onClientSelect(client.id)}
                    >
                      Focar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                  <p className="text-lg font-semibold">{client.stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Usuários</p>
                </div>
                
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <UserCheck className="h-5 w-5 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-semibold">{client.stats.activeDoctors}</p>
                  <p className="text-xs text-muted-foreground">Médicos</p>
                </div>
                
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <Calendar className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                  <p className="text-lg font-semibold">{client.stats.totalAppointments}</p>
                  <p className="text-xs text-muted-foreground">Agendamentos</p>
                </div>
              </div>

              {/* User Activity */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Usuários Ativos</span>
                  <span>{client.stats.activeUsers}/{client.stats.totalUsers}</span>
                </div>
                <Progress 
                  value={client.stats.totalUsers > 0 ? (client.stats.activeUsers / client.stats.totalUsers) * 100 : 0} 
                  className="h-2" 
                />
              </div>

              {client.stats.pendingUsers > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {client.stats.pendingUsers} usuário(s) aguardando aprovação
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};