import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStableAuth } from '@/hooks/useStableAuth';
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
  LayoutGrid,
  BarChart3,
  Shield,
  Phone,
  MapPin,
  MessageSquare,
  Loader2,
  Save
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
import { ClinicHealthData, calculateHealthScore, useMultiClinicHealthScores } from '@/hooks/useClinicHealthScore';
import { 
  SmartAlertsCenter, 
  EnhancedClinicCard, 
  ClinicHealthScoreGauge,
  OnboardingChecklist 
} from './clinic-health';

interface DashboardData {
  summary: {
    total_clinics: number;
    total_doctors: number;
    total_patients: number;
    total_appointments_today: number;
    total_users: number;
    total_future_appointments: number;
  };
  clinics: ClinicHealthData[];
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

interface EditFormData {
  nome: string;
  telefone: string;
  whatsapp: string;
  endereco: string;
  ativo: boolean;
  data_minima_agendamento: string;
  dias_busca_inicial: number;
  dias_busca_expandida: number;
  mensagem_bloqueio_padrao: string;
}

export function MultiClinicDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<ClinicHealthData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showManageModal, setShowManageModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    nome: '',
    telefone: '',
    whatsapp: '',
    endereco: '',
    ativo: true,
    data_minima_agendamento: '',
    dias_busca_inicial: 14,
    dias_busca_expandida: 45,
    mensagem_bloqueio_padrao: ''
  });
  
  const { toast } = useToast();
  const { profile } = useStableAuth();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch clinic stats and extended config data in parallel
      const [
        statsResult, 
        llmConfigResult, 
        businessRulesResult,
        atendimentosResult,
        horariosResult,
        atividadeResult
      ] = await Promise.all([
        supabase.rpc('get_all_clinics_stats'),
        supabase.from('llm_clinic_config').select('cliente_id, telefone, whatsapp, endereco'),
        supabase.from('business_rules').select('cliente_id').eq('ativo', true),
        supabase.from('atendimentos').select('cliente_id').eq('ativo', true),
        supabase.from('horarios_configuracao').select('cliente_id').eq('ativo', true),
        supabase.rpc('get_clinic_recent_activity')
      ]);

      if (statsResult.error) {
        console.error('Erro ao buscar estatísticas:', statsResult.error);
        setError(statsResult.error.message);
        return;
      }

      const dashboardData = statsResult.data as unknown as DashboardData;
      
      // Enhance clinics with config data
      if (dashboardData?.clinics) {
        const llmConfigs = new Map(
          (llmConfigResult.data || []).map(c => [c.cliente_id, c])
        );
        const clinicsWithRules = new Set(
          (businessRulesResult.data || []).map(r => r.cliente_id)
        );

        // Count atendimentos per clinic
        const atendimentosMap = new Map<string, number>();
        (atendimentosResult.data || []).forEach(a => {
          atendimentosMap.set(a.cliente_id, (atendimentosMap.get(a.cliente_id) || 0) + 1);
        });

        // Count horarios per clinic
        const horariosMap = new Map<string, number>();
        (horariosResult.data || []).forEach(h => {
          horariosMap.set(h.cliente_id, (horariosMap.get(h.cliente_id) || 0) + 1);
        });

        // Map activity data
        const atividadeMap = new Map<string, { agendamentos_7_dias: number; agendamentos_30_dias: number }>();
        (atividadeResult.data || []).forEach((a: any) => {
          atividadeMap.set(a.cliente_id, {
            agendamentos_7_dias: Number(a.agendamentos_7_dias) || 0,
            agendamentos_30_dias: Number(a.agendamentos_30_dias) || 0
          });
        });

        dashboardData.clinics = dashboardData.clinics.map(clinic => {
          const llmConfig = llmConfigs.get(clinic.id);
          const servicesCount = atendimentosMap.get(clinic.id) || 0;
          const horariosCount = horariosMap.get(clinic.id) || 0;
          const atividade = atividadeMap.get(clinic.id);
          
          return {
            ...clinic,
            has_llm_config: !!llmConfig,
            has_business_rules: clinicsWithRules.has(clinic.id),
            has_contact_info: !!(llmConfig?.telefone || llmConfig?.whatsapp),
            telefone: llmConfig?.telefone,
            whatsapp: llmConfig?.whatsapp,
            endereco: llmConfig?.endereco,
            // Real data checks
            has_services: servicesCount > 0,
            services_count: servicesCount,
            has_schedule_config: horariosCount > 0 || clinic.doctors_count > 0,
            schedule_count: horariosCount,
            // Activity metrics
            last_7_days_count: atividade?.agendamentos_7_dias || 0,
            last_30_days_count: atividade?.agendamentos_30_dias || 0,
            is_active_recently: (atividade?.agendamentos_7_dias || 0) > 0
          };
        });
      }

      setData(dashboardData);
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

  // Calculate overall health metrics
  const healthMetrics = useMemo(() => {
    if (!data?.clinics?.length) return null;
    
    const healthScores = data.clinics.map(c => calculateHealthScore(c));
    const avgScore = Math.round(
      healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length
    );
    const healthyCount = healthScores.filter(h => h.score >= 75).length;
    const criticalCount = healthScores.filter(h => h.criticalIssues.length > 0).length;
    
    return {
      avgScore,
      healthyCount,
      criticalCount,
      totalClinics: data.clinics.length
    };
  }, [data]);

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

  const handleNavigateToClinic = (clinicId: string, action?: string) => {
    const clinic = data?.clinics?.find(c => c.id === clinicId);
    if (clinic) {
      setSelectedClinic(clinic);
      setActiveTab('onboarding');
    }
  };

  const handleOpenManageModal = async (clinic: ClinicHealthData) => {
    setSelectedClinic(clinic);
    setEditFormData({
      nome: clinic.nome,
      telefone: clinic.telefone || '',
      whatsapp: clinic.whatsapp || '',
      endereco: clinic.endereco || '',
      ativo: clinic.ativo !== false,
      data_minima_agendamento: '',
      dias_busca_inicial: 14,
      dias_busca_expandida: 45,
      mensagem_bloqueio_padrao: ''
    });
    
    // Fetch LLM config
    const { data: llmConfig } = await supabase
      .from('llm_clinic_config')
      .select('*')
      .eq('cliente_id', clinic.id)
      .maybeSingle();
    
    if (llmConfig) {
      setEditFormData(prev => ({
        ...prev,
        data_minima_agendamento: llmConfig.data_minima_agendamento || '',
        dias_busca_inicial: llmConfig.dias_busca_inicial || 14,
        dias_busca_expandida: llmConfig.dias_busca_expandida || 45,
        mensagem_bloqueio_padrao: llmConfig.mensagem_bloqueio_padrao || ''
      }));
    }
    
    setShowManageModal(true);
  };

  const handleSaveClinic = async () => {
    if (!selectedClinic) return;
    
    setSaving(true);
    try {
      // Update basic clinic data
      const { error: updateError } = await supabase.rpc('atualizar_cliente', {
        p_cliente_id: selectedClinic.id,
        p_nome: editFormData.nome,
        p_ativo: editFormData.ativo,
        p_telefone: editFormData.telefone || null,
        p_whatsapp: editFormData.whatsapp || null,
        p_endereco: editFormData.endereco || null,
        p_admin_user_id: profile?.user_id
      });

      if (updateError) throw updateError;

      // Sync LLM config
      const { error: llmError } = await supabase.rpc('sincronizar_cliente_llm', {
        p_cliente_id: selectedClinic.id,
        p_nome_clinica: editFormData.nome,
        p_telefone: editFormData.telefone || null,
        p_whatsapp: editFormData.whatsapp || null,
        p_endereco: editFormData.endereco || null,
        p_data_minima_agendamento: editFormData.data_minima_agendamento || null,
        p_dias_busca_inicial: editFormData.dias_busca_inicial,
        p_dias_busca_expandida: editFormData.dias_busca_expandida,
        p_mensagem_bloqueio_padrao: editFormData.mensagem_bloqueio_padrao || null
      });

      if (llmError) console.error('Erro ao sincronizar LLM config:', llmError);

      toast({
        title: 'Sucesso',
        description: 'Clínica atualizada com sucesso',
      });

      setShowManageModal(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar clínica',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

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

      {/* Cards de Resumo Geral com Health Score */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Health Score</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-bold" style={{ color: healthMetrics?.avgScore && healthMetrics.avgScore >= 75 ? '#10B981' : healthMetrics?.avgScore && healthMetrics.avgScore >= 50 ? '#F59E0B' : '#EF4444' }}>
                {healthMetrics?.avgScore || 0}
              </p>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Clínicas</span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-2xl font-bold">{data?.summary.total_clinics || 0}</p>
              {healthMetrics && (
                <span className="text-xs text-green-500">
                  ({healthMetrics.healthyCount} saudável)
                </span>
              )}
            </div>
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

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2">
            <Shield className="h-4 w-4" />
            Health & Onboarding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Smart Alerts */}
          {data?.clinics && (
            <SmartAlertsCenter 
              clinics={data.clinics} 
              onNavigateToClinic={handleNavigateToClinic}
              maxAlerts={6}
            />
          )}

          {/* Enhanced Clinic Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Clínicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data?.clinics?.map((clinic) => (
                <EnhancedClinicCard
                  key={clinic.id}
                  clinic={clinic}
                  onManage={() => handleOpenManageModal(clinic)}
                  onConfigureLLM={() => {
                    setSelectedClinic(clinic);
                    setActiveTab('onboarding');
                  }}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
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
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
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
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Health Scores Overview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Health Score por Clínica
                </CardTitle>
                <CardDescription>
                  Visão geral da saúde de configuração de cada clínica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {data?.clinics?.map(clinic => {
                    const health = calculateHealthScore(clinic);
                    return (
                      <div 
                        key={clinic.id}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedClinic(clinic)}
                      >
                        <ClinicHealthScoreGauge health={health} size="md" />
                        <span className="text-sm font-medium text-center truncate w-full">
                          {clinic.nome}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {health.criticalIssues.length > 0 
                            ? `${health.criticalIssues.length} crítico`
                            : health.warnings.length > 0
                            ? `${health.warnings.length} avisos`
                            : 'OK'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Selected Clinic Onboarding or Instructions */}
            <div>
              {selectedClinic ? (
                <OnboardingChecklist 
                  clinic={selectedClinic}
                  onNavigateToAction={(action) => {
                    console.log('Navigate to:', action, 'for clinic:', selectedClinic.id);
                    // Here you would integrate with your navigation/routing
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center text-center gap-3">
                      <Shield className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Selecione uma clínica para ver o checklist de onboarding
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Gerenciamento */}
      <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gerenciar {selectedClinic?.nome}
            </DialogTitle>
            <DialogDescription>
              Edite os dados da clínica e configurações da API LLM
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
              <TabsTrigger value="llm">Config LLM</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Clínica</Label>
                <Input
                  id="nome"
                  value={editFormData.nome}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome da clínica"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone" className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    value={editFormData.telefone}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, telefone: e.target.value }))}
                    placeholder="(XX) XXXX-XXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    value={editFormData.whatsapp}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="(XX) XXXXX-XXXX"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Endereço
                </Label>
                <Textarea
                  id="endereco"
                  value={editFormData.endereco}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, endereco: e.target.value }))}
                  placeholder="Endereço completo"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="ativo"
                  checked={editFormData.ativo}
                  onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, ativo: checked }))}
                />
                <Label htmlFor="ativo">Clínica ativa</Label>
              </div>
            </TabsContent>

            <TabsContent value="llm" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dias_busca_inicial">Dias Busca Inicial</Label>
                  <Input
                    id="dias_busca_inicial"
                    type="number"
                    value={editFormData.dias_busca_inicial}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, dias_busca_inicial: parseInt(e.target.value) || 14 }))}
                    min={1}
                    max={90}
                  />
                  <p className="text-xs text-muted-foreground">Período inicial para buscar horários</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_busca_expandida">Dias Busca Expandida</Label>
                  <Input
                    id="dias_busca_expandida"
                    type="number"
                    value={editFormData.dias_busca_expandida}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, dias_busca_expandida: parseInt(e.target.value) || 45 }))}
                    min={1}
                    max={180}
                  />
                  <p className="text-xs text-muted-foreground">Período expandido se não houver vagas</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_minima">Data Mínima de Agendamento</Label>
                <Input
                  id="data_minima"
                  type="date"
                  value={editFormData.data_minima_agendamento}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, data_minima_agendamento: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Data mínima para aceitar agendamentos (deixe vazio para usar hoje)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mensagem_bloqueio">Mensagem de Bloqueio Padrão</Label>
                <Textarea
                  id="mensagem_bloqueio"
                  value={editFormData.mensagem_bloqueio_padrao}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, mensagem_bloqueio_padrao: e.target.value }))}
                  placeholder="Mensagem exibida quando a agenda está bloqueada..."
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <Separator className="my-4" />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowManageModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveClinic} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
