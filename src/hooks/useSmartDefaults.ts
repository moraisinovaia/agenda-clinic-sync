import { useState, useEffect } from 'react';
import { Doctor } from '@/types/scheduling';
import { format, addDays, isWeekend, nextMonday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SmartDefaultsState {
  lastSelectedDoctor: Doctor | null;
  preferredTimeSlots: string[];
  commonConvenios: string[];
  recentPatients: Array<{
    nome: string;
    dataNascimento: string;
    telefone: string;
  }>;
  suggestedDate: string;
}

interface UseSmartDefaultsReturn extends SmartDefaultsState {
  updateLastDoctor: (doctor: Doctor) => void;
  addTimeSlot: (timeSlot: string) => void;
  addConvenio: (convenio: string) => void;
  addRecentPatient: (patient: { nome: string; dataNascimento: string; telefone: string }) => void;
  getNextAvailableDate: (doctor?: Doctor) => string;
  getPreferredTimeSlots: () => string[];
  getMostUsedConvenio: () => string | null;
  clearDefaults: () => void;
}

const STORAGE_KEY = 'endogastro-smart-defaults';

export const useSmartDefaults = (): UseSmartDefaultsReturn => {
  const [state, setState] = useState<SmartDefaultsState>({
    lastSelectedDoctor: null,
    preferredTimeSlots: [],
    commonConvenios: [],
    recentPatients: [],
    suggestedDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState(prev => ({
          ...prev,
          ...parsed,
          suggestedDate: getNextBusinessDay(),
        }));
      }
    } catch (error) {
      console.warn('Failed to load smart defaults from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const toStore = {
        lastSelectedDoctor: state.lastSelectedDoctor,
        preferredTimeSlots: state.preferredTimeSlots,
        commonConvenios: state.commonConvenios,
        recentPatients: state.recentPatients.slice(-10), // Keep only last 10
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.warn('Failed to save smart defaults to localStorage:', error);
    }
  }, [state]);

  const getNextBusinessDay = (): string => {
    let nextDay = addDays(new Date(), 1);
    
    // If tomorrow is weekend, get next Monday
    if (isWeekend(nextDay)) {
      nextDay = nextMonday(nextDay);
    }
    
    return format(nextDay, 'yyyy-MM-dd');
  };

  const updateLastDoctor = (doctor: Doctor) => {
    setState(prev => ({
      ...prev,
      lastSelectedDoctor: doctor,
    }));
  };

  const addTimeSlot = (timeSlot: string) => {
    setState(prev => {
      const existing = prev.preferredTimeSlots;
      const updated = [timeSlot, ...existing.filter(slot => slot !== timeSlot)].slice(0, 5);
      return {
        ...prev,
        preferredTimeSlots: updated,
      };
    });
  };

  const addConvenio = (convenio: string) => {
    if (!convenio) return;
    
    setState(prev => {
      const existing = prev.commonConvenios;
      const updated = [convenio, ...existing.filter(c => c !== convenio)].slice(0, 8);
      return {
        ...prev,
        commonConvenios: updated,
      };
    });
  };

  const addRecentPatient = (patient: { nome: string; dataNascimento: string; telefone: string }) => {
    setState(prev => {
      const existing = prev.recentPatients;
      const updated = [patient, ...existing.filter(p => p.nome !== patient.nome)].slice(0, 10);
      return {
        ...prev,
        recentPatients: updated,
      };
    });
  };

  const getNextAvailableDate = (doctor?: Doctor): string => {
    // For now, return next business day
    // This could be enhanced to check doctor's actual availability
    return getNextBusinessDay();
  };

  const getPreferredTimeSlots = (): string[] => {
    // Return most used time slots, or default common times
    if (state.preferredTimeSlots.length > 0) {
      return state.preferredTimeSlots;
    }
    
    // Default preferred times based on common patterns
    return ['08:00', '09:00', '10:00', '14:00', '15:00'];
  };

  const getMostUsedConvenio = (): string | null => {
    return state.commonConvenios[0] || null;
  };

  const clearDefaults = () => {
    setState({
      lastSelectedDoctor: null,
      preferredTimeSlots: [],
      commonConvenios: [],
      recentPatients: [],
      suggestedDate: getNextBusinessDay(),
    });
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    ...state,
    updateLastDoctor,
    addTimeSlot,
    addConvenio,
    addRecentPatient,
    getNextAvailableDate,
    getPreferredTimeSlots,
    getMostUsedConvenio,
    clearDefaults,
  };
};