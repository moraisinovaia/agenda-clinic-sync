import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Building2, 
  Users, 
  UserCheck, 
  Calendar, 
  CalendarCheck, 
  RefreshCw,
  TrendingUp,
  Activity,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  X,
  Stethoscope,
  Clock
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
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
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

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  clinic: string;
  message: string;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const PERIOD_OPTIONS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '14', label: 'Últimos 14 dias' },
  { value: '30', label: 'Últimos 30 dias' },
];

export function MultiClinicDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<ClinicStats | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7');

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
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Gerar alertas automaticamente
  const alerts = useMemo<Alert[]>(() => {
    if (!data?.clinics) return [];
    
    const alertList: Alert[] = [];
    
    data.clinics.forEach(clinic => {
      if (clinic.doctors_count === 0) {
        alertList.push({
          id: `${clinic.id}-no-doctors`,
          type: 'critical',
          clinic: clinic.nome,
          message: 'Clínica sem médicos ativos cadastrados'
        });
      }
      if (clinic.patients_count === 0) {
        alertList.push({
          id: `${clinic.id}-no-patients`,
          type: 'warning',
          clinic: clinic.nome,
          message: 'Clínica sem pacientes cadastrados'
        });
      }
      if (clinic.future_appointments === 0 && clinic.doctors_count > 0) {
        alertList.push({
          id: `${clinic.id}-no-future`,
          type: 'warning',
          clinic: clinic.nome,
          message: 'Nenhum agendamento futuro'
        });
      }
      // Clínica nova (últimos 7 dias) sem atividade
      const createdAt = parseISO(clinic.created_at);
      const sevenDaysAgo = subDays(new Date(), 7);
      if (createdAt > sevenDaysAgo && clinic.total_appointments === 0) {
        alertList.push({
          id: `${clinic.id}-new-inactive`,
          type: 'info',
          clinic: clinic.nome,
          message: 'Clínica nova sem atividade'
        });
      }
    });
    
    return alertList;
  }, [data]);

  const getHealthStatus = (clinic: ClinicStats) => {
    if (clinic.doctors_count === 0) return { status: 'critical', label: 'Sem médicos' };
    if (clinic.patients_count === 0) return { status: 'warning', label: 'Sem pacientes' };
    if (clinic.future_appointments === 0) return { status: 'info', label: 'Sem agendamentos' };
    return { status: 'success', label: 'Ativo' };
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400';
      case 'warning': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400';
      case 'critical': return 'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400';
      case 'info': return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  // Exportar para CSV
  const exportToCSV = () => {
    if (!data) return;
    
    const headers = ['Clínica', 'Médicos', 'Pacientes', 'Ag. Total', 'Ag. Futuros', 'Ag. Hoje', 'Usuários', 'Status'];
    const rows = data.clinics.map(clinic => {
      const health = getHealthStatus(clinic);
      return [
        clinic.nome,
        clinic.doctors_count,
        clinic.patients_count,
        clinic.total_appointments,
        clinic.future_appointments,
        clinic.today_appointments,
        clinic.users_count,
        health.label
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-clinicas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Exportar para PDF (via print)
  const exportToPDF = () => {
    window.print();
  };

  // Preparar dados para gráficos
  const appointmentsChartData = data?.clinics?.map(clinic => ({
    name: clinic.nome.length > 12 ? clinic.nome.substring(0, 12) + '...' : clinic.nome,
    fullName: clinic.nome,
    agendamentos: clinic.total_appointments,
    futuros: clinic.future_appointments,
    hoje: clinic.today_appointments,
  })) || [];

  const patientsDistribution = data?.clinics?.map((clinic, index) => ({
    name: clinic.nome,
    value: clinic.patients_count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  })).filter(item => item.value > 0) || [];

  // Dados de tendência filtrados por período
  const trendData = useMemo(() => {
    if (!data?.clinics?.length) return [];
    
    const daysToShow = parseInt(selectedPeriod);
    const firstClinic = data.clinics[0];
    if (!firstClinic.last_7_days_appointments) return [];
    
    // Usar os dados disponíveis (últimos 7 dias da API)
    const availableDays = firstClinic.last_7_days_appointments.slice(-Math.min(daysToShow, 7));
    
    return availableDays.map((day, index) => {
      const aggregated: Record<string, any> = { 
        date: format(parseISO(day.date), 'dd/MM', { locale: ptBR }) 
      };
      data.clinics.forEach(clinic => {
        const clinicDays = clinic.last_7_days_appointments?.slice(-Math.min(daysToShow, 7));
        const clinicDay = clinicDays?.[index];
        if (clinicDay) {
          aggregated[clinic.nome] = clinicDay.count;
        }
      });
      return aggregated;
    });
  }, [data, selectedPeriod]);

  // Dados para o modal de detalhes
  const selectedClinicTrendData = useMemo(() => {
    if (!selectedClinic?.last_7_days_appointments) return [];
    return selectedClinic.last_7_days_appointments.map(day => ({
      date: format(parseISO(day.date), 'dd/MM', { locale: ptBR }),
      agendamentos: day.count
    }));
  }, [selectedClinic]);

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
    <div className="space-y-6 print:space-y-4" id="dashboard-content">
      {/* Header com refresh, filtros e exportação */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="animate-fade-in">
          <h2 className="text-2xl font-bold">Dashboard Multi-Clínica</h2>
          <p className="text-muted-foreground">
            Visão geral de todas as clínicas em tempo real
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro de período */}
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dropdown de exportação */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="mr-2 h-4 w-4" />
                PDF (Imprimir)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {lastUpdate && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
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

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Dashboard Multi-Clínica</h1>
        <p className="text-sm text-muted-foreground">
          Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      {/* Seção de Alertas */}
      {alerts.length > 0 && (
        <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen} className="print:hidden">
          <Card className="border-yellow-500/30 bg-yellow-500/5 dark:bg-yellow-500/10 animate-fade-in">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <CardTitle className="text-base">
                      Alertas do Sistema
                    </CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      {alerts.length}
                    </Badge>
                  </div>
                  {alertsOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div 
                      key={alert.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        alert.type === 'critical' ? 'bg-red-500/10 dark:bg-red-500/20' :
                        alert.type === 'warning' ? 'bg-yellow-500/10 dark:bg-yellow-500/20' :
                        'bg-blue-500/10 dark:bg-blue-500/20'
                      }`}
                    >
                      {getAlertIcon(alert.type)}
                      <span className="font-medium text-sm">{alert.clinic}:</span>
                      <span className="text-sm text-muted-foreground">{alert.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Cards de Resumo Geral com animação staggered */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { icon: Building2, label: 'Clínicas Ativas', value: data?.summary.total_clinics || 0 },
          { icon: UserCheck, label: 'Médicos Ativos', value: data?.summary.total_doctors || 0 },
          { icon: Users, label: 'Pacientes', value: (data?.summary.total_patients || 0).toLocaleString('pt-BR') },
          { icon: CalendarCheck, label: 'Agend. Hoje', value: data?.summary.total_appointments_today || 0 },
          { icon: Calendar, label: 'Agend. Futuros', value: (data?.summary.total_future_appointments || 0).toLocaleString('pt-BR') },
          { icon: Activity, label: 'Usuários', value: data?.summary.total_users || 0 },
        ].map((item, index) => (
          <Card 
            key={item.label}
            className="hover-lift animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cards por Clínica - Clicáveis */}
      <div className="print:break-before-page">
        <h3 className="text-lg font-semibold mb-4">Estatísticas por Clínica</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.clinics?.map((clinic, index) => {
            const health = getHealthStatus(clinic);
            return (
              <Card 
                key={clinic.id} 
                className="hover-lift cursor-pointer transition-all animate-scale-in group"
                style={{ animationDelay: `${index * 75}ms` }}
                onClick={() => setSelectedClinic(clinic)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold truncate group-hover:text-primary transition-colors">
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
                  <p className="text-xs text-muted-foreground mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    Clique para ver detalhes →
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
        {/* Gráfico de Barras - Agendamentos por Clínica */}
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
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
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      color: 'hsl(var(--card-foreground))'
                    }}
                    labelFormatter={(_, payload) => payload[0]?.payload?.fullName || ''}
                  />
                  <Legend />
                  <Bar dataKey="agendamentos" name="Total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="futuros" name="Futuros" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hoje" name="Hoje" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
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
        <Card className="animate-fade-in" style={{ animationDelay: '250ms' }}>
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
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      color: 'hsl(var(--card-foreground))'
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

        {/* Gráfico de Linha - Tendência */}
        <Card className="lg:col-span-2 animate-fade-in print:col-span-1" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Tendência de Agendamentos ({PERIOD_OPTIONS.find(o => o.value === selectedPeriod)?.label})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      color: 'hsl(var(--card-foreground))'
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
                      dot={{ r: 4, fill: CHART_COLORS[index % CHART_COLORS.length] }}
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

      {/* Modal de Detalhes da Clínica */}
      <Dialog open={!!selectedClinic} onOpenChange={(open) => !open && setSelectedClinic(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClinic && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {selectedClinic.nome}
                </DialogTitle>
                <DialogDescription>
                  Detalhes completos da clínica
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Informações gerais */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Stethoscope className="h-6 w-6 mx-auto text-primary mb-2" />
                    <p className="text-2xl font-bold">{selectedClinic.doctors_count}</p>
                    <p className="text-xs text-muted-foreground">Médicos</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Users className="h-6 w-6 mx-auto text-primary mb-2" />
                    <p className="text-2xl font-bold">{selectedClinic.patients_count.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-muted-foreground">Pacientes</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <Activity className="h-6 w-6 mx-auto text-primary mb-2" />
                    <p className="text-2xl font-bold">{selectedClinic.users_count}</p>
                    <p className="text-xs text-muted-foreground">Usuários</p>
                  </div>
                </div>

                {/* Estatísticas de agendamentos */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Agendamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-0 pb-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xl font-bold text-primary">{selectedClinic.today_appointments}</p>
                        <p className="text-xs text-muted-foreground">Hoje</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{selectedClinic.future_appointments.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Futuros</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{selectedClinic.total_appointments.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Mini gráfico de tendência */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Tendência (Últimos 7 dias)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedClinicTrendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={150}>
                        <AreaChart data={selectedClinicTrendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 'var(--radius)',
                              color: 'hsl(var(--card-foreground))'
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="agendamentos" 
                            stroke="hsl(var(--primary))" 
                            fill="hsl(var(--primary) / 0.2)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
                        Sem dados de tendência
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Informações adicionais */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Cadastrada em {format(parseISO(selectedClinic.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
