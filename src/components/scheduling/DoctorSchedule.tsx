import { useState, useMemo } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Doctor, Appointment } from '@/types/scheduling';

interface DoctorScheduleProps {
  doctor: Doctor;
  appointments: Appointment[];
  onNewAppointment: () => void;
}

export function DoctorSchedule({ doctor, appointments, onNewAppointment }: DoctorScheduleProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentWeek]);

  const workingDays = weekDays.filter(day => 
    doctor.workingHours.days.includes(day.getDay())
  );

  const getAppointmentsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(apt => apt.date === dateStr);
  };

  const generateTimeSlots = () => {
    const slots = [];
    const [startHour, startMinute] = doctor.workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = doctor.workingHours.end.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMinute = startMinute;
    
    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      slots.push(timeStr);
      
      currentMinute += doctor.consultationDuration;
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60);
        currentMinute = currentMinute % 60;
      }
    }
    
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const previousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7));
  };

  const nextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">
            Agenda - {doctor.name}
          </CardTitle>
          <Button onClick={onNewAppointment} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={previousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="font-medium">
            {format(weekDays[0], 'dd MMM', { locale: ptBR })} - {format(weekDays[6], 'dd MMM yyyy', { locale: ptBR })}
          </span>
          
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-6 gap-2">
          {/* Coluna de horários */}
          <div className="space-y-2">
            <div className="h-12 flex items-center justify-center font-medium text-sm">
              Horário
            </div>
            {timeSlots.map(time => (
              <div key={time} className="h-16 flex items-center justify-center text-sm text-muted-foreground border-r">
                {time}
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {workingDays.map((day, dayIndex) => {
            const dayAppointments = getAppointmentsForDay(day);
            
            return (
              <div key={dayIndex} className="space-y-2">
                <div className="h-12 flex flex-col items-center justify-center bg-muted/50 rounded-lg">
                  <div className="font-medium text-sm">
                    {format(day, 'EEE', { locale: ptBR })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'dd/MM')}
                  </div>
                </div>
                
                {timeSlots.map(time => {
                  const appointment = dayAppointments.find(apt => apt.time === time);
                  
                  return (
                    <div key={time} className="h-16 border rounded-md p-1">
                      {appointment ? (
                        <div className="h-full bg-primary/10 border border-primary/20 rounded px-2 py-1 text-xs">
                          <div className="font-medium truncate">
                            {appointment.patient.fullName}
                          </div>
                          <div className="text-muted-foreground">
                            {appointment.type === 'consultation' ? 'Consulta' : 'Exame'}
                          </div>
                          <Badge 
                            variant={appointment.status === 'scheduled' ? 'default' : 'secondary'}
                            className="text-xs mt-1"
                          >
                            {appointment.status === 'scheduled' ? 'Agendado' : 
                             appointment.status === 'completed' ? 'Concluído' : 'Cancelado'}
                          </Badge>
                        </div>
                      ) : (
                        <div className="h-full bg-muted/20 rounded flex items-center justify-center text-xs text-muted-foreground">
                          Livre
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}