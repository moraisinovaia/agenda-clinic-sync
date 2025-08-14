import { Users, Calendar, Clock, AlertTriangle, CheckCircle, Activity, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStatsMetrics } from '@/hooks/useStatsMetrics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatsCardsProps {
  // Mantém props para compatibilidade, mas não usa mais
  doctors?: any[];
  appointments?: any[];
}

export const StatsCards = ({ doctors = [], appointments = [] }: StatsCardsProps) => {
  const { metrics, loading, error, refetch } = useStatsMetrics();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <Card className="col-span-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-destructive">Erro ao carregar métricas</p>
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header com informações de atualização */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Última atualização: {format(metrics.lastUpdated, 'HH:mm', { locale: ptBR })}
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Cards principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Médicos Ativos */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{metrics.activeDoctors}</p>
                      <p className="text-xs text-muted-foreground">Médicos Ativos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total de médicos ativos: {metrics.activeDoctors} de {metrics.totalDoctors}</p>
            </TooltipContent>
          </Tooltip>

          {/* Agendamentos de Hoje */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{metrics.todayAppointments}</p>
                      <p className="text-xs text-muted-foreground">Hoje</p>
                      {metrics.activeDoctorsToday > 0 && (
                        <p className="text-xs text-emerald-600">{metrics.activeDoctorsToday} médicos ativados</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Agendamentos confirmados para hoje</p>
            </TooltipContent>
          </Tooltip>

          {/* Agendamentos de Amanhã */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-lg font-bold">{metrics.tomorrowAppointments}</p>
                      <p className="text-xs text-muted-foreground">Amanhã</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Agendamentos previstos para amanhã</p>
            </TooltipContent>
          </Tooltip>

          {/* Agendamentos Pendentes */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                    <div>
                      <p className="text-lg font-bold">{metrics.pendingAppointments}</p>
                      <p className="text-xs text-muted-foreground">Agendados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Agendamentos que aguardam confirmação</p>
            </TooltipContent>
          </Tooltip>

          {/* Agendamentos Confirmados */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                    <div>
                      <p className="text-lg font-bold">{metrics.confirmedAppointments}</p>
                      <p className="text-xs text-muted-foreground">Confirmados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Agendamentos já confirmados</p>
            </TooltipContent>
          </Tooltip>

          {/* Taxa de Ocupação */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium">Ocupação Hoje</span>
                    </div>
                    <div className="text-lg font-bold">{metrics.occupationRate}%</div>
                    <Progress value={metrics.occupationRate} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {metrics.activeDoctorsToday}/{metrics.activeDoctors} médicos
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p>Percentual de médicos com agendamentos hoje</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};