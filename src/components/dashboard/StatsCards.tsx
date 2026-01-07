import { useMemo } from 'react';
import { Users, Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';
import { format, addDays } from 'date-fns';

interface StatsCardsProps {
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
}

export const StatsCards = ({ doctors, appointments }: StatsCardsProps) => {
  // ⚡ OTIMIZAÇÃO: Memoizar cálculos de datas
  const { today, tomorrow } = useMemo(() => ({
    today: format(new Date(), 'yyyy-MM-dd'),
    tomorrow: format(addDays(new Date(), 1), 'yyyy-MM-dd')
  }), []);
  
  // ⚡ OTIMIZAÇÃO: Memoizar todos os cálculos de estatísticas
  const stats = useMemo(() => {
    // Uma única passagem para calcular tudo
    let todayCount = 0;
    let tomorrowCount = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    const activeDoctorIds = new Set<string>();
    
    for (const apt of appointments) {
      // Ignorar cancelados e excluídos para stats principais
      if (apt.status === 'cancelado' || apt.status === 'excluido') continue;
      if (apt.data_agendamento < today) continue;
      
      if (apt.data_agendamento === today) {
        todayCount++;
        activeDoctorIds.add(apt.medico_id);
      }
      if (apt.data_agendamento === tomorrow) tomorrowCount++;
      if (apt.status === 'agendado') pendingCount++;
      if (apt.status === 'confirmado') confirmedCount++;
    }
    
    return {
      todayAppointments: todayCount,
      tomorrowAppointments: tomorrowCount,
      pendingAppointments: pendingCount,
      confirmedAppointments: confirmedCount,
      activeDoctorsToday: activeDoctorIds.size
    };
  }, [appointments, today, tomorrow]);
  
  // ⚡ OTIMIZAÇÃO: Memoizar contagem de médicos ativos
  const activeDoctorsCount = useMemo(() => 
    doctors.filter(d => d.ativo).length
  , [doctors]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {/* Active Doctors */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <p className="text-lg font-bold">{activeDoctorsCount}</p>
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
              <p className="text-lg font-bold">{stats.todayAppointments}</p>
              <p className="text-xs text-muted-foreground">Hoje</p>
              {stats.activeDoctorsToday > 0 && (
                <p className="text-xs text-green-600">{stats.activeDoctorsToday} médicos ativados</p>
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
              <p className="text-lg font-bold">{stats.tomorrowAppointments}</p>
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
              <p className="text-lg font-bold">{stats.pendingAppointments}</p>
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
              <p className="text-lg font-bold">{stats.confirmedAppointments}</p>
              <p className="text-xs text-muted-foreground">Confirmados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};