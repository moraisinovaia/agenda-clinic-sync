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

  // Função unificada de busca híbrida que suporta múltiplos critérios
  const performHybridSearch = useCallback(async (birthDate?: string, name?: string, phone?: string) => {
    // Cancelar busca anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Validações básicas
    const hasValidBirthDate = birthDate && birthDate.length === 10;
    const hasValidName = name?.trim() && name.trim().length >= 3;
    const hasValidPhone = phone?.trim() && phone.trim().length >= 8;

    if (!hasValidBirthDate && !hasValidName && !hasValidPhone) {
      setState(prev => ({ ...prev, foundPatients: [], showResults: false }));
      return [];
    }

    // Criar chave de cache única para busca híbrida
    const cacheKey = `hybrid:${birthDate || ''}:${name || ''}:${phone || ''}`;
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
      
      let allResults: Patient[] = [];

      // Busca por data de nascimento (mais específica)
      if (hasValidBirthDate) {
        const { data: birthDateResults, error } = await supabase
          .from('pacientes')
          .select('*')
          .eq('data_nascimento', birthDate)
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        allResults = [...allResults, ...(birthDateResults || [])];
      }

      // Busca por nome (busca independente ou para complementar resultados)
      if (hasValidName) {
        const trimmedName = name!.trim();
        const { data: nameResults, error } = await supabase
          .from('pacientes')
          .select('*')
          .ilike('nome_completo', `%${trimmedName}%`)
          .order('updated_at', { ascending: false })
          .limit(50); // Aumentar limite para garantir todos os resultados
        
        if (error) throw error;
        allResults = [...allResults, ...(nameResults || [])];
      }

      // Busca por telefone (se especificado)
      if (hasValidPhone) {
        const cleanPhone = phone!.replace(/\D/g, '');
        const { data: phoneResults, error } = await supabase
          .from('pacientes')
          .select('*')
          .or(`telefone.ilike.%${cleanPhone}%,celular.ilike.%${cleanPhone}%`)
          .order('updated_at', { ascending: false })
          .limit(30); // Aumentar limite também aqui
        
        if (error) throw error;
        allResults = [...allResults, ...(phoneResults || [])];
      }

      // Remover duplicatas baseado no ID (não no nome/convenio)
      const uniquePatients = allResults.reduce((acc, current) => {
        const existing = acc.find(patient => patient.id === current.id);
        if (!existing) acc.push(current);
        return acc;
      }, [] as Patient[]);

      // Ordenação inteligente
      const sortedPatients = uniquePatients.sort((a, b) => {
        // 1. Priorizar matches exatos de nome se busca por nome
        if (hasValidName) {
          const nameToMatch = name!.trim().toLowerCase();
          const aExactName = a.nome_completo.toLowerCase() === nameToMatch;
          const bExactName = b.nome_completo.toLowerCase() === nameToMatch;
          if (aExactName && !bExactName) return -1;
          if (!aExactName && bExactName) return 1;
        }
        
        // 2. Priorizar dados mais completos
        const aCompleteness = (a.telefone ? 1 : 0) + (a.celular ? 1 : 0);
        const bCompleteness = (b.telefone ? 1 : 0) + (b.celular ? 1 : 0);
        if (aCompleteness !== bCompleteness) return bCompleteness - aCompleteness;
        
        // 3. Mais recentes primeiro
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      // Armazenar no cache
      cacheRef.current[cacheKey] = sortedPatients;

      setState(prev => ({
        ...prev,
        foundPatients: sortedPatients,
        showResults: sortedPatients.length > 0,
      }));

      return sortedPatients;

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
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performHybridSearch(birthDate);
    }, 300);
  }, [performHybridSearch]);

  // Buscar por nome com debounce
  const searchByName = useCallback((name: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performHybridSearch(undefined, name);
    }, 500);
  }, [performHybridSearch]);

  // Nova função para busca híbrida
  const searchHybrid = useCallback((birthDate?: string, name?: string, phone?: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performHybridSearch(birthDate, name, phone);
    }, 300);
  }, [performHybridSearch]);

  // Buscar por telefone
  const searchByPhone = useCallback((phone: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performHybridSearch(undefined, undefined, phone);
    }, 500);
  }, [performHybridSearch]);

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
    searchByPhone,
    searchHybrid,
    selectPatient,
    clearSearch,
    hideResults,
  };
}