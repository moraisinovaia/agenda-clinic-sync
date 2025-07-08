import { useState } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Doctor, Appointment } from '@/types/scheduling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';

interface DoctorScheduleProps {
  doctor: Doctor;
  appointments: Appointment[];
}

export function DoctorSchedule({ doctor, appointments }: DoctorScheduleProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(
      appointment => 
        appointment.medico_id === doctor.id && 
        appointment.data_agendamento === dateStr
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado':
        return 'bg-blue-100 text-blue-800';
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      case 'realizado':
        return 'bg-gray-100 text-gray-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agenda - {doctor.nome}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2">
              {format(weekStart, 'dd/MM', { locale: ptBR })} - {format(addDays(weekStart, 6), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {doctor.especialidade}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDate(day);
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            
            return (
              <div key={index} className="space-y-2">
                <div className={`text-center p-2 rounded-lg text-sm font-medium ${
                  isToday ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <div className="text-xs">
                    {format(day, 'EEE', { locale: ptBR })}
                  </div>
                  <div>
                    {format(day, 'dd', { locale: ptBR })}
                  </div>
                </div>
                
                <div className="space-y-1 min-h-[200px]">
                  {dayAppointments.length > 0 ? (
                    dayAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="p-2 bg-white border rounded-lg shadow-sm text-xs space-y-1"
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="font-medium">
                            {appointment.hora_agendamento}
                          </span>
                        </div>
                        
                        <div className="truncate font-medium">
                          Paciente agendado
                        </div>
                        
                        <div className="text-muted-foreground truncate">
                          Consulta/Exame
                        </div>
                        
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getStatusColor(appointment.status)}`}
                        >
                          {appointment.status}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground p-2 text-center">
                      Sem agendamentos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}