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
      }));
      return cachedResults;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      
      let data: Patient[] = [];

      if (type === 'birthDate') {
        const { data: results, error } = await supabase
          .from('pacientes')
          .select('*')
          .eq('data_nascimento', query)
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        data = results || [];
      } else if (type === 'name') {
        const trimmedQuery = query.trim();
        const { data: results, error } = await supabase
          .from('pacientes')
          .select('*')
          .ilike('nome_completo', `%${trimmedQuery}%`)
          .order('updated_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        data = results || [];
      }

      // Consolidar pacientes por nome_completo + data_nascimento
      const consolidatedPatients = consolidatePatients(data);

      // Armazenar no cache
      cacheRef.current[cacheKey] = consolidatedPatients;

      setState(prev => ({
        ...prev,
        foundPatients: consolidatedPatients,
        showResults: consolidatedPatients.length > 0,
      }));

      return consolidatedPatients;

    } catch (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pacientes',
        variant: 'destructive',
      });

      setState(prev => ({
        ...prev,
        foundPatients: [],
        showResults: false,
      }));
      return [];
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Buscar por data de nascimento com debounce
  const searchByBirthDate = useCallback((birthDate: string) => {
    // Cancelar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Aplicar debounce
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(birthDate, 'birthDate');
    }, 300);
  }, [performSearch]);

  // Buscar por nome com debounce
  const searchByName = useCallback((name: string) => {
    // Cancelar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Aplicar debounce
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(name, 'name');
    }, 500);
  }, [performSearch]);

  // Selecionar paciente e limpar resultados
  const selectPatient = useCallback((patient: ConsolidatedPatient) => {
    setState(prev => ({
      ...prev,
      selectedPatient: patient,
      showResults: false,
      foundPatients: [],
    }));
  }, []);

  // Limpar busca e resultados
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
  }, []);

  // Esconder resultados (mas manter cache)
  const hideResults = useCallback(() => {
    setState(prev => ({ ...prev, showResults: false }));
  }, []);

  return {
    loading: state.loading,
    foundPatients: state.foundPatients,
    showResults: state.showResults,
    selectedPatient: state.selectedPatient,
    searchByBirthDate,
    searchByName,
    selectPatient,
    clearSearch,
    hideResults,
  };
}