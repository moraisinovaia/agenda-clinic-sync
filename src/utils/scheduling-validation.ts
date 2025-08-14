import { Doctor } from '@/types/scheduling';

/**
 * Utilitários para validação de agendamentos
 */

// Mapear dias da semana para português
export const DAY_NAMES_PT = {
  0: 'domingo',
  1: 'segunda-feira', 
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado'
} as const;

export const DAY_KEYS = {
  0: 'domingo',
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado'
} as const;

/**
 * Verifica se um médico trabalha em um determinado dia da semana
 */
export function isDoctorWorkingDay(doctor: Doctor, date: Date): boolean {
  if (!doctor.horarios) return true; // Se não tem horários definidos, assume que trabalha

  const dayOfWeek = date.getDay() as keyof typeof DAY_KEYS;
  const dayKey = DAY_KEYS[dayOfWeek];
  
  return doctor.horarios[dayKey] && doctor.horarios[dayKey].length > 0;
}

/**
 * Obter horários disponíveis para um médico em uma data
 */
export function getDoctorAvailableHours(doctor: Doctor, date: Date): string[] {
  if (!doctor.horarios) return [];

  const dayOfWeek = date.getDay() as keyof typeof DAY_KEYS;
  const dayKey = DAY_KEYS[dayOfWeek];
  
  return doctor.horarios[dayKey] || [];
}

/**
 * Obter nome do dia da semana em português
 */
export function getDayNameInPortuguese(date: Date): string {
  const dayOfWeek = date.getDay() as keyof typeof DAY_NAMES_PT;
  return DAY_NAMES_PT[dayOfWeek];
}

/**
 * Obter próximas datas disponíveis para um médico
 */
export function getNextAvailableDates(
  doctor: Doctor,
  startDate: Date,
  blockedDates: any[] = [],
  limit: number = 5
): Date[] {
  const suggestions: Date[] = [];
  let currentDate = new Date(startDate);
  let attempts = 0;
  const maxAttempts = 60; // 2 meses

  while (suggestions.length < limit && attempts < maxAttempts) {
    // Verificar se médico trabalha neste dia
    if (isDoctorWorkingDay(doctor, currentDate)) {
      // Verificar se não está bloqueado
      const dateStr = currentDate.toISOString().split('T')[0];
      const isBlocked = blockedDates.some(blocked => 
        blocked.medico_id === doctor.id &&
        blocked.status === 'ativo' &&
        dateStr >= blocked.data_inicio &&
        dateStr <= blocked.data_fim
      );
      
      if (!isBlocked) {
        suggestions.push(new Date(currentDate));
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    attempts++;
  }

  return suggestions;
}