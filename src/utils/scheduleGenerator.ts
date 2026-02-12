import { format, eachDayOfInterval, getDay } from 'date-fns';
import { ScheduleConfiguration, EmptyTimeSlot } from '@/types/schedule-generator';

// Cache global para memoização de slots de tempo
const timeSlotsCache = new Map<string, string[]>();

export function generateTimeSlotsForPeriod(
  config: ScheduleConfiguration,
  startDate: Date,
  endDate: Date,
  existingAppointments: { data_agendamento: string; hora_agendamento: string }[]
): EmptyTimeSlot[] {
  const slots: EmptyTimeSlot[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Usar Set para busca O(1) em vez de Array.some() O(n)
  const appointmentSet = new Set(
    existingAppointments.map(apt => `${apt.data_agendamento}|${apt.hora_agendamento}`)
  );
  
  for (const day of days) {
    const dayOfWeek = getDay(day);
    if (dayOfWeek !== config.dia_semana) continue;
    
    const dateStr = format(day, 'yyyy-MM-dd');
    const timeSlots = generateTimeSlots(
      config.hora_inicio,
      config.hora_fim,
      config.intervalo_minutos
    );
    
    for (const time of timeSlots) {
      if (!appointmentSet.has(`${dateStr}|${time}`)) {
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
  // Criar chave única para cache
  const cacheKey = `${start}-${end}-${interval}`;
  
  if (timeSlotsCache.has(cacheKey)) {
    return timeSlotsCache.get(cacheKey)!;
  }
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
  
  // Armazenar no cache
  timeSlotsCache.set(cacheKey, slots);
  
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
