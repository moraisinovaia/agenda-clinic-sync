import { useState, useCallback } from 'react';
import { Doctor } from '@/types/scheduling';

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  type?: 'no_working_day' | 'explicit_block' | 'past_date' | 'holiday' | 'time_conflict';
  suggestions?: string[];
}

export function useEnhancedSchedulingValidation() {
  const [loading, setLoading] = useState(false);

  // Obter horários disponíveis para um médico em uma data (para referência)
  const getDoctorAvailableHours = useCallback((doctor: Doctor, date: Date): string[] => {
    if (!doctor.horarios) return [];

    const dayOfWeek = date.getDay();
    const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dayName = dayNames[dayOfWeek];
    
    return doctor.horarios[dayName] || [];
  }, []);

  // Validar data e horário (sem validação automática de dias da semana)
  const validateDateAndTime = useCallback((
    doctor: Doctor, 
    date: Date, 
    time?: string,
    blockedDates: any[] = []
  ): ValidationResult => {
    const now = new Date();
    const dateStr = date.toISOString().split('T')[0];

    // 1. Verificar se é data passada
    if (date < now) {
      return {
        isValid: false,
        type: 'past_date',
        message: 'Não é possível agendar para datas passadas'
      };
    }

    // 2. Verificar apenas bloqueios explícitos (removida validação de dias da semana)
    const blocked = blockedDates.find(blocked => 
      blocked.medico_id === doctor.id &&
      blocked.status === 'ativo' &&
      dateStr >= blocked.data_inicio &&
      dateStr <= blocked.data_fim
    );

    if (blocked) {
      return {
        isValid: false,
        type: 'explicit_block',
        message: blocked.motivo || 'Data bloqueada na agenda'
      };
    }

    // 3. Tudo OK - recepcionista pode agendar livremente
    return { isValid: true };
  }, []);

  // Sugerir próximas datas disponíveis (sem restrição de dias da semana)
  const suggestNextAvailableDates = useCallback((
    doctor: Doctor, 
    startDate: Date,
    blockedDates: any[] = [],
    limit: number = 5
  ): Date[] => {
    const suggestions: Date[] = [];
    let currentDate = new Date(startDate);
    let attempts = 0;
    const maxAttempts = 30; // 1 mês

    while (suggestions.length < limit && attempts < maxAttempts) {
      const validation = validateDateAndTime(doctor, currentDate, undefined, blockedDates);
      if (validation.isValid) {
        suggestions.push(new Date(currentDate));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
      attempts++;
    }

    return suggestions;
  }, [validateDateAndTime]);

  return {
    loading,
    getDoctorAvailableHours,
    validateDateAndTime,
    suggestNextAvailableDates
  };
}