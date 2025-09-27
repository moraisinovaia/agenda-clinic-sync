import { Users, Calendar, Clock, AlertTriangle, TrendingUp, Activity, CheckCircle, Stethoscope } from 'lucide-react';
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
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = addDays(new Date(), 1).toISOString().split('T')[0];
  
  // Filtrar apenas agendamentos válidos (não cancelados nem excluídos) para estatísticas
  const validAppointments = appointments.filter(apt => 
    apt.status !== 'cancelado' && apt.status !== 'excluido'
  );
  
  const totalAppointments = validAppointments.length;
  const todayAppointments = validAppointments.filter(apt => apt.data_agendamento === today).length;
  const tomorrowAppointments = validAppointments.filter(apt => apt.data_agendamento === tomorrow).length;
  const pendingAppointments = validAppointments.filter(apt => apt.status === 'agendado').length;
  const confirmedAppointments = validAppointments.filter(apt => apt.status === 'confirmado').length;
  
  // Para cancelados, mostramos todos (incluindo cancelados e excluídos)
  const cancelledAppointments = appointments.filter(apt => 
    apt.status === 'cancelado' || apt.status === 'excluido'
  ).length;
  
  // Calculate active doctors (with appointments today)
  const activeDoctorsToday = new Set(
    appointments
      .filter(apt => apt.data_agendamento === today && apt.status !== 'cancelado' && apt.status !== 'excluido')
      .map(apt => apt.medico_id)
  ).size;

  // Calculate occupation rate for today
  const activeDoctors = doctors.filter(d => d.ativo).length;
  const occupationRate = activeDoctors > 0 ? Math.round((activeDoctorsToday / activeDoctors) * 100) : 0;

  // Calculate MAPA appointments by type
  const mapa24hAppointments = validAppointments.filter(apt => 
    apt.atendimentos?.nome === 'MAPA 24H'
  ).length;
  
  const mapaMrpaAppointments = validAppointments.filter(apt => 
    apt.atendimentos?.nome === 'MAPA MRPA'
  ).length;
  
  const totalMapaAppointments = mapa24hAppointments + mapaMrpaAppointments;

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
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="text-lg font-bold">{confirmedAppointments}</p>
              <p className="text-xs text-muted-foreground">Confirmados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MAPA Exams */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Exames MAPA</span>
            </div>
            <div className="text-lg font-bold">{totalMapaAppointments}</div>
            {totalMapaAppointments > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {mapa24hAppointments} MAPA 24H • {mapaMrpaAppointments} MRPA
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};