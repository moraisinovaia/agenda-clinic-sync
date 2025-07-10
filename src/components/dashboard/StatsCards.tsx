import { Users, Calendar, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';

interface StatsCardsProps {
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
}

export const StatsCards = ({ doctors, appointments }: StatsCardsProps) => {
  const totalAppointments = appointments.length;
  const todayAppointments = appointments.filter(apt => 
    apt.data_agendamento === new Date().toISOString().split('T')[0]
  ).length;
  const pendingAppointments = appointments.filter(apt => 
    apt.status === 'agendado'
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{doctors.length}</p>
              <p className="text-sm text-muted-foreground">Médicos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalAppointments}</p>
              <p className="text-sm text-muted-foreground">Total Agendamentos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{todayAppointments}</p>
              <p className="text-sm text-muted-foreground">Hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="h-8 w-8 rounded-full flex items-center justify-center">
              {pendingAppointments}
            </Badge>
            <div>
              <p className="text-2xl font-bold">{pendingAppointments}</p>
              <p className="text-sm text-muted-foreground">Agendados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};