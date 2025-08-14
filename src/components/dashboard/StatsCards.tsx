import { Users, Calendar, Clock, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StatsCardsProps {
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
}

export const StatsCards = ({ doctors, appointments }: StatsCardsProps) => {
  // 🔍 DIAGNÓSTICO CRÍTICO: Log dos dados recebidos no dashboard
  console.log('🔍 [DASHBOARD-DIAGNÓSTICO] StatsCards recebeu:', {
    totalAppointments: appointments.length,
    appointmentsType: typeof appointments,
    isArray: Array.isArray(appointments),
    statusBreakdown: appointments.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    sampleAppointments: appointments.slice(0, 3).map(apt => ({
      id: apt.id,
      status: apt.status,
      data: apt.data_agendamento,
      paciente: apt.pacientes?.nome_completo
    }))
  });
  
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];
  
  const totalAppointments = appointments.length;
  const todayAppointments = appointments.filter(apt => apt.data_agendamento === today).length;
  const tomorrowAppointments = appointments.filter(apt => apt.data_agendamento === tomorrow).length;
  const pendingAppointments = appointments.filter(apt => apt.status === 'agendado').length;
  const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmado').length;
  const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelado').length;

  // 🔍 DIAGNÓSTICO: Log dos cálculos finais
  console.log('🔍 [DASHBOARD-DIAGNÓSTICO] Estatísticas calculadas:', {
    totalAppointments,
    pendingAppointments,
    confirmedAppointments,
    cancelledAppointments,
    todayAppointments,
    tomorrowAppointments
  });

  // 🚨 ALERTA: Se agendados < 1200, temos um problema
  if (pendingAppointments < 1200) {
    console.error('🚨 [DASHBOARD-DIAGNÓSTICO] ALERTA: Poucos agendamentos exibidos!', {
      esperado: 'pelo menos 1200',
      atual: pendingAppointments,
      diferenca: 1200 - pendingAppointments
    });
  }
  
  // Calculate active doctors (with appointments today)
  const activeDoctorsToday = new Set(
    appointments
      .filter(apt => apt.data_agendamento === today && apt.status !== 'cancelado')
      .map(apt => apt.medico_id)
  ).size;

  // Calculate occupation rate for today
  const activeDoctors = doctors.filter(d => d.ativo).length;
  const occupationRate = activeDoctors > 0 ? Math.round((activeDoctorsToday / activeDoctors) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
      {/* Active Doctors */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-bold">{doctors.filter(d => d.ativo).length}</p>
              <p className="text-xs text-muted-foreground">Médicos Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Appointments */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-bold">{todayAppointments}</p>
              <p className="text-xs text-muted-foreground">Hoje</p>
              {activeDoctorsToday > 0 && (
                <p className="text-xs text-green-600">{activeDoctorsToday} médicos ativados</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tomorrow's Appointments */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-bold">{tomorrowAppointments}</p>
              <p className="text-xs text-muted-foreground">Amanhã</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Appointments */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <div>
              <p className="text-lg font-bold">{pendingAppointments}</p>
              <p className="text-xs text-muted-foreground">Agendados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmed Appointments */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="h-6 w-6 rounded-full flex items-center justify-center text-xs">
              ✓
            </Badge>
            <div>
              <p className="text-lg font-bold">{confirmedAppointments}</p>
              <p className="text-xs text-muted-foreground">Confirmados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Occupation Rate */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Ocupação Hoje</span>
            </div>
            <div className="text-lg font-bold">{occupationRate}%</div>
            <Progress value={occupationRate} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {activeDoctorsToday}/{activeDoctors} médicos
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};