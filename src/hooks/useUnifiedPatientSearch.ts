import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { toast } from '@/components/ui/use-toast';

interface PatientSearchState {
  loading: boolean;
  foundPatients: Patient[];
  showResults: boolean;
  selectedPatient: Patient | null;
}

export function useUnifiedPatientSearch() {
  const [state, setState] = useState<PatientSearchState>({
    loading: false,
    foundPatients: [],
    showResults: false,
    selectedPatient: null,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<{ [key: string]: Patient[] }>({});

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

      // Remover duplicatas
      const uniquePatients = data.reduce((acc, current) => {
        const existing = acc.find(patient => 
          patient.nome_completo.toLowerCase() === current.nome_completo.toLowerCase() &&
          patient.convenio === current.convenio
        );
        if (!existing) acc.push(current);
        return acc;
      }, [] as Patient[]);

      // Armazenar no cache
      cacheRef.current[cacheKey] = uniquePatients;

      setState(prev => ({
        ...prev,
        foundPatients: uniquePatients,
        showResults: uniquePatients.length > 0,
      }));

      return uniquePatients;

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
  const selectPatient = useCallback((patient: Patient) => {
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