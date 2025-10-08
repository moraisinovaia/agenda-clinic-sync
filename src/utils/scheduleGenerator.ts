import { format, eachDayOfInterval, getDay } from 'date-fns';
import { ScheduleConfiguration, EmptyTimeSlot } from '@/types/schedule-generator';

export function generateTimeSlotsForPeriod(
  config: ScheduleConfiguration,
  startDate: Date,
  endDate: Date,
  existingAppointments: { data_agendamento: string; hora_agendamento: string }[]
): EmptyTimeSlot[] {
  const slots: EmptyTimeSlot[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  for (const day of days) {
    // Verificar se é o dia da semana configurado
    if (getDay(day) !== config.dia_semana) continue;
    
    const dateStr = format(day, 'yyyy-MM-dd');
    
    // Gerar slots de horário
    const timeSlots = generateTimeSlots(
      config.hora_inicio,
      config.hora_fim,
      config.intervalo_minutos
    );
    
    for (const time of timeSlots) {
      // CRÍTICO: Verificar se já existe agendamento neste horário
      const hasAppointment = existingAppointments.some(
        apt => apt.data_agendamento === dateStr && apt.hora_agendamento === time
      );
      
      // Só criar slot vazio se NÃO existe agendamento
      if (!hasAppointment) {
        slots.push({
          medico_id: config.medico_id,
          data: dateStr,
          hora: time,
          status: 'disponivel',
          cliente_id: config.cliente_id
        });
      }
    }
  }
  
  return slots;
}

export function generateTimeSlots(start: string, end: string, interval: number): string[] {
  const slots: string[] = [];
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  while (currentMinutes < endMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const minute = currentMinutes % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    currentMinutes += interval;
  }
  
  return slots;
}

export function validateScheduleConfig(config: ScheduleConfiguration): string[] {
  const errors: string[] = [];
  
  const [startHour, startMinute] = config.hora_inicio.split(':').map(Number);
  const [endHour, endMinute] = config.hora_fim.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  if (startMinutes >= endMinutes) {
    errors.push('Hora de início deve ser menor que hora de fim');
  }
  
  if (config.dia_semana < 0 || config.dia_semana > 6) {
    errors.push('Dia da semana inválido');
  }
  
  if (![10, 15, 20, 30].includes(config.intervalo_minutos)) {
    errors.push('Intervalo deve ser 10, 15, 20 ou 30 minutos');
  }
  
  return errors;
}
