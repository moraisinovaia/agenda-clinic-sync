import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Users, Calendar, Settings } from 'lucide-react';
import { useClientMetrics } from '@/hooks/useClientMetrics';
import { useClientConfigurations } from '@/hooks/useClientConfigurations';
import { Skeleton } from '@/components/ui/skeleton';

export const MultiTenantDashboard = () => {
  const { todayMetrics, loading: metricsLoading, updateMetrics } = useClientMetrics();
  const { getConfigurationByKey, loading: configLoading } = useClientConfigurations();

  const isLoading = metricsLoading || configLoading;
  
  const maxAppointments = parseInt(getConfigurationByKey('scheduling', 'max_appointments_per_day') || '40');
  const themeColor = getConfigurationByKey('interface', 'theme_color') || '#0ea5e9';
  const whatsappEnabled = getConfigurationByKey('notifications', 'whatsapp_enabled') === 'true';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Multi-Tenant</h2>
          <p className="text-muted-foreground">
            Visão geral das métricas e configurações da sua clínica
          </p>
        </div>
        <Button onClick={updateMetrics} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar Métricas
        </Button>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayMetrics?.total_agendamentos || 0}</div>
            <p className="text-xs text-muted-foreground">
              de {maxAppointments} possíveis hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Agendamentos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayMetrics?.agendamentos_criados || 0}</div>
            <p className="text-xs text-muted-foreground">criados hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayMetrics?.usuarios_ativos || 0}</div>
            <p className="text-xs text-muted-foreground">usuários aprovados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pacientes Cadastrados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayMetrics?.pacientes_cadastrados || 0}</div>
            <p className="text-xs text-muted-foreground">no sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Configurações Atuais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Ativas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Cor do Tema</h4>
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: themeColor }}
                />
                <Badge variant="secondary">{themeColor}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Limite de Agendamentos</h4>
              <Badge variant="outline">{maxAppointments} por médico/dia</Badge>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">WhatsApp</h4>
              <Badge variant={whatsappEnabled ? "default" : "secondary"}>
                {whatsappEnabled ? "Habilitado" : "Desabilitado"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status de Agendamentos */}
      {todayMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Agendamentos Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {todayMetrics.agendamentos_confirmados}
                </div>
                <p className="text-sm text-muted-foreground">Confirmados</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {todayMetrics.total_agendamentos - todayMetrics.agendamentos_confirmados - todayMetrics.agendamentos_cancelados}
                </div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {todayMetrics.agendamentos_cancelados}
                </div>
                <p className="text-sm text-muted-foreground">Cancelados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};