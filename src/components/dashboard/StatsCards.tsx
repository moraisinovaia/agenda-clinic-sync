import { Calendar, Users, CheckCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';

interface StatsCardsProps {
  doctors: Doctor[];
  appointments: AppointmentWithRelations[];
}

export const StatsCards = ({ doctors, appointments }: StatsCardsProps) => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Estatísticas calculadas
  const activeDoctors = doctors.filter(d => d.ativo).length;
  const todayAppointments = appointments.filter(apt => 
    apt.data_agendamento === today && apt.status !== 'cancelado'
  ).length;
  const tomorrowAppointments = appointments.filter(apt => 
    apt.data_agendamento === tomorrow && apt.status !== 'cancelado'
  ).length;
  const totalScheduled = appointments.filter(apt => 
    apt.status === 'agendado' || apt.status === 'confirmado'
  ).length;
  const confirmedAppointments = appointments.filter(apt => 
    apt.status === 'confirmado'
  ).length;
  
  // Cálculo de ocupação de hoje
  const doctorsWithAppointmentsToday = new Set(
    appointments
      .filter(apt => apt.data_agendamento === today && apt.status !== 'cancelado')
      .map(apt => apt.medico_id)
  ).size;
  
  const occupationPercentage = activeDoctors > 0 
    ? Math.round((doctorsWithAppointmentsToday / activeDoctors) * 100)
    : 0;

  const stats = [
    {
      title: "Médicos Ativos",
      value: activeDoctors,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Hoje",
      value: todayAppointments,
      subtitle: `${doctorsWithAppointmentsToday} médicos ativados`,
      icon: Calendar,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Amanhã",
      value: tomorrowAppointments,
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Agendados",
      value: totalScheduled,
      icon: totalScheduled > 500 ? AlertTriangle : Clock,
      color: totalScheduled > 500 ? "text-orange-600" : "text-indigo-600",
      bgColor: totalScheduled > 500 ? "bg-orange-50" : "bg-indigo-50",
      hasAlert: totalScheduled > 500,
    },
    {
      title: "Confirmados",
      value: confirmedAppointments,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Ocupação Hoje",
      value: `${occupationPercentage}%`,
      subtitle: `${doctorsWithAppointmentsToday}/${activeDoctors} médicos`,
      icon: TrendingUp,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className={`relative ${stat.bgColor} border-0`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className="relative">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              {stat.hasAlert && (
                <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-orange-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            {stat.subtitle && (
              <p className="text-xs text-muted-foreground mt-1">
                {stat.subtitle}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};