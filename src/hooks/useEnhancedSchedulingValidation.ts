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

  // Verificar se é dia de trabalho do médico
  const isDoctorWorkingDay = useCallback((doctor: Doctor, date: Date): boolean => {
    if (!doctor.horarios) return true; // Se não tem horários definidos, assume que trabalha

    const dayOfWeek = date.getDay(); // 0=domingo, 1=segunda, ..., 6=sábado
    const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dayName = dayNames[dayOfWeek];
    
    return doctor.horarios[dayName] && doctor.horarios[dayName].length > 0;
  }, []);

  // Obter horários disponíveis para um médico em uma data
  const getDoctorAvailableHours = useCallback((doctor: Doctor, date: Date): string[] => {
    if (!doctor.horarios) return [];

    const dayOfWeek = date.getDay();
    const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const dayName = dayNames[dayOfWeek];
    
    return doctor.horarios[dayName] || [];
  }, []);

  // Validar data e horário completos
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

    // 2. Verificar se médico trabalha neste dia da semana
    if (!isDoctorWorkingDay(doctor, date)) {
      const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
      const dayName = dayNames[date.getDay()];
      const availableDays = Object.keys(doctor.horarios || {})
        .filter(day => doctor.horarios?.[day]?.length > 0)
        .map(day => {
          const dayMap: { [key: string]: string } = {
            'domingo': 'domingos',
            'segunda': 'segundas-feiras',
            'terca': 'terças-feiras', 
            'quarta': 'quartas-feiras',
            'quinta': 'quintas-feiras',
            'sexta': 'sextas-feiras',
            'sabado': 'sábados'
          };
          return dayMap[day] || day;
        });

      return {
        isValid: false,
        type: 'no_working_day',
        message: `${doctor.nome} não atende às ${dayName}s`,
        suggestions: availableDays.length > 0 
          ? [`Dias disponíveis: ${availableDays.join(', ')}`]
          : []
      };
    }

    // 3. Verificar bloqueios explícitos
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

    // 4. Se foi informado horário, verificar se está nos horários do médico
    if (time) {
      const availableHours = getDoctorAvailableHours(doctor, date);
      if (availableHours.length > 0 && !availableHours.includes(time)) {
        return {
          isValid: false,
          type: 'time_conflict',
          message: `Horário ${time} não está disponível para ${doctor.nome}`,
          suggestions: [
            `Horários disponíveis: ${availableHours.join(', ')}`
          ]
        };
      }
    }

    // 5. Tudo OK
    return { isValid: true };
  }, [isDoctorWorkingDay, getDoctorAvailableHours]);

  // Sugerir próximas datas disponíveis
  const suggestNextAvailableDates = useCallback((
    doctor: Doctor, 
    startDate: Date,
    blockedDates: any[] = [],
    limit: number = 5
  ): Date[] => {
    const suggestions: Date[] = [];
    let currentDate = new Date(startDate);
    let attempts = 0;
    const maxAttempts = 60; // 2 meses

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
    isDoctorWorkingDay,
    getDoctorAvailableHours,
    validateDateAndTime,
    suggestNextAvailableDates
  };
}