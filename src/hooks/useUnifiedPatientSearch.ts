import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { ConsolidatedPatient, consolidatePatients } from '@/types/consolidated-patient';
import { toast } from '@/components/ui/use-toast';

interface PatientSearchState {
  loading: boolean;
  foundPatients: ConsolidatedPatient[];
  showResults: boolean;
  selectedPatient: ConsolidatedPatient | null;
}

export function useUnifiedPatientSearch() {
  const [state, setState] = useState<PatientSearchState>({
    loading: false,
    foundPatients: [],
    showResults: false,
    selectedPatient: null,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<{ [key: string]: ConsolidatedPatient[] }>({});

  // Função unificada de busca que evita chamadas duplicadas
  const performSearch = useCallback(async (query: string, type: 'birthDate' | 'name') => {
    // Cancelar busca anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Validações básicas
    if (type === 'birthDate' && (!query || query.length !== 10)) {
      setState(prev => ({ ...prev, foundPatients: [], showResults: false }));
      return [];
    }

    if (type === 'name' && (!query?.trim() || query.trim().length < 3)) {
      setState(prev => ({ ...prev, foundPatients: [], showResults: false }));
      return [];
    }

    // Verificar cache
    const cacheKey = `${type}:${query}`;
    if (cacheRef.current[cacheKey]) {
      const cachedResults = cacheRef.current[cacheKey];
      setState(prev => ({
        ...prev,
        foundPatients: cachedResults,
        showResults: cachedResults.length > 0,
        loading: false
      }));
      return cachedResults;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      let searchQuery = supabase.from('pacientes').select('*');

      if (type === 'birthDate') {
        searchQuery = searchQuery.eq('data_nascimento', query);
      } else {
        searchQuery = searchQuery.ilike('nome_completo', `%${query.trim()}%`);
      }

      const { data: patients, error } = await searchQuery.limit(20).order('updated_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar pacientes:', error);
        toast({
          title: "Erro ao buscar pacientes",
          description: error.message,
          variant: "destructive",
        });
        setState(prev => ({ ...prev, foundPatients: [], showResults: false, loading: false }));
        return [];
      }

      if (!patients || patients.length === 0) {
        setState(prev => ({ ...prev, foundPatients: [], showResults: false, loading: false }));
        return [];
      }

      // Buscar últimos convênios usados em agendamentos
      const { data: lastAppointments } = await supabase
        .from('agendamentos')
        .select('paciente_id, convenio, data_agendamento, hora_agendamento')
        .in('paciente_id', patients.map(p => p.id))
        .order('data_agendamento', { ascending: false })
        .order('hora_agendamento', { ascending: false });

      // Mapear último convênio por paciente
      const lastConvenios: Record<string, string> = {};
      if (lastAppointments) {
        const patientToKeyMap: Record<string, string> = {};
        patients.forEach(p => {
          patientToKeyMap[p.id] = `${p.nome_completo.toLowerCase().trim()}-${p.data_nascimento}`;
        });

        lastAppointments.forEach(appointment => {
          const patientKey = patientToKeyMap[appointment.paciente_id];
          if (patientKey && appointment.convenio) {
            // Sempre atualizar com o convênio mais recente
            lastConvenios[patientKey] = appointment.convenio;
          }
        });
      }

      const consolidatedPatients = consolidatePatients(patients as Patient[], lastConvenios);
      
      // Salvar no cache
      cacheRef.current[cacheKey] = consolidatedPatients;

      setState(prev => ({
        ...prev,
        foundPatients: consolidatedPatients,
        showResults: consolidatedPatients.length > 0,
        loading: false
      }));

      return consolidatedPatients;
    } catch (error) {
      console.error('Erro inesperado ao buscar pacientes:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao buscar pacientes. Tente novamente.",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, foundPatients: [], showResults: false, loading: false }));
      return [];
    }
  }, []);

  // Buscar por data de nascimento com debounce
  const searchByBirthDate = useCallback((birthDate: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(birthDate, 'birthDate');
    }, 300);
  }, [performSearch]);

  // Buscar por nome com debounce
  const searchByName = useCallback((name: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(name, 'name');  
    }, 500);
  }, [performSearch]);

  // Selecionar paciente
  const selectPatient = useCallback((patient: ConsolidatedPatient) => {
    setState(prev => ({
      ...prev,
      selectedPatient: patient,
      showResults: false
    }));
  }, []);

  // Limpar busca
  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    setState({
      loading: false,
      foundPatients: [],
      showResults: false,
      selectedPatient: null,
    });
    
    // Limpar cache também
    cacheRef.current = {};
  }, []);

  // Esconder resultados sem limpar
  const hideResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      showResults: false
    }));
  }, []);

  return {
    ...state,
    searchByBirthDate,
    searchByName,
    selectPatient,
    clearSearch,
    hideResults,
  };
}