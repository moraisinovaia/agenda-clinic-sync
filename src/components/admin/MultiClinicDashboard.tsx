import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Building2, 
  Users, 
  UserCheck, 
  Calendar, 
  CalendarCheck, 
  RefreshCw,
  TrendingUp,
  Activity,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClinicStats {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  doctors_count: number;
  patients_count: number;
  total_appointments: number;
  future_appointments: number;
  today_appointments: number;
  users_count: number;
  last_7_days_appointments: Array<{ date: string; count: number }>;
}

interface DashboardData {
  summary: {
    total_clinics: number;
    total_doctors: number;
    total_patients: number;
    total_appointments_today: number;
    total_users: number;
    total_future_appointments: number;
  };
  clinics: ClinicStats[];
  timestamp: string;
}

// Cores vibrantes e distintas para os gráficos
const CHART_COLORS = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#F59E0B', // Laranja
  '#8B5CF6', // Roxo
  '#EC4899', // Rosa
  '#06B6D4', // Ciano
];

const BAR_COLORS = {
  total: '#3B82F6',    // Azul
  futuros: '#10B981',  // Verde  
  hoje: '#F59E0B',     // Laranja
};

export function MultiClinicDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase.rpc('get_all_clinics_stats');

      if (rpcError) {
        console.error('Erro ao buscar estatísticas:', rpcError);
        setError(rpcError.message);
        return;
      }

      setData(result as unknown as DashboardData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh a cada 60 segundos
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const getHealthStatus = (clinic: ClinicStats) => {
    if (clinic.doctors_count === 0) return { status: 'warning', label: 'Sem médicos' };
    if (clinic.patients_count === 0) return { status: 'warning', label: 'Sem pacientes' };
    if (clinic.future_appointments === 0) return { status: 'info', label: 'Sem agendamentos' };
    return { status: 'success', label: 'Ativo' };
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'info': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Preparar dados para gráficos
  const appointmentsChartData = data?.clinics?.map(clinic => ({
    name: clinic.nome.length > 12 ? clinic.nome.substring(0, 12) + '...' : clinic.nome,
    agendamentos: clinic.total_appointments,
    futuros: clinic.future_appointments,
    hoje: clinic.today_appointments,
  })) || [];

  const patientsDistribution = data?.clinics?.map((clinic, index) => ({
    name: clinic.nome,
    value: clinic.patients_count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  })).filter(item => item.value > 0) || [];

  // Dados de tendência dos últimos 7 dias (agregado de todas as clínicas)
  const trendData = data?.clinics?.length 
    ? data.clinics[0].last_7_days_appointments?.map((day, index) => {
        const aggregated: Record<string, any> = { 
          date: format(parseISO(day.date), 'dd/MM', { locale: ptBR }) 
        };
        data.clinics.forEach(clinic => {
          const clinicDay = clinic.last_7_days_appointments?.[index];
          if (clinicDay) {
            aggregated[clinic.nome] = clinicDay.count;
          }
        });
        return aggregated;
      }) || []
    : [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Carregando estatísticas..." />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="font-semibold">Erro ao carregar dashboard</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Multi-Clínica</h2>
          <p className="text-muted-foreground">
            Visão geral de todas as clínicas em tempo real
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {format(lastUpdate, 'HH:mm:ss', { locale: ptBR })}
            </span>
          )}
          <Button 
            onClick={fetchData} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo Geral */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Clínicas Ativas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data?.summary.total_clinics || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Médicos Ativos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data?.summary.total_doctors || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pacientes</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {(data?.summary.total_patients || 0).toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Agend. Hoje</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data?.summary.total_appointments_today || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Agend. Futuros</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {(data?.summary.total_future_appointments || 0).toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Usuários</span>
            </div>
            <p className="text-2xl font-bold mt-1">{data?.summary.total_users || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards por Clínica */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Estatísticas por Clínica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.clinics?.map((clinic) => {
            const health = getHealthStatus(clinic);
            return (
              <Card key={clinic.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold truncate">
                      {clinic.nome}
                    </CardTitle>
                    <Badge variant="outline" className={getHealthColor(health.status)}>
                      {health.label}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Desde {format(parseISO(clinic.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Médicos</span>
                      <p className="font-semibold">{clinic.doctors_count}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Pacientes</span>
                      <p className="font-semibold">{clinic.patients_count.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ag. Futuros</span>
                      <p className="font-semibold">{clinic.future_appointments.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ag. Hoje</span>
                      <p className="font-semibold text-primary">{clinic.today_appointments}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ag. Total</span>
                      <p className="font-semibold">{clinic.total_appointments.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Usuários</span>
                      <p className="font-semibold">{clinic.users_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Agendamentos por Clínica */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Agendamentos por Clínica
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={appointmentsChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Legend />
                  <Bar dataKey="agendamentos" name="Total" fill={BAR_COLORS.total} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="futuros" name="Futuros" fill={BAR_COLORS.futuros} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hoje" name="Hoje" fill={BAR_COLORS.hoje} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Distribuição de Pacientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Distribuição de Pacientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patientsDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={patientsDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={true}
                  >
                    {patientsDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                    formatter={(value: number) => value.toLocaleString('pt-BR')}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Linha - Tendência 7 dias */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Tendência de Agendamentos (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Legend />
                  {data?.clinics?.map((clinic, index) => (
                    <Line
                      key={clinic.id}
                      type="monotone"
                      dataKey={clinic.nome}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
