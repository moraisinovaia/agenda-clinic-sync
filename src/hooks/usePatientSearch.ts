import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { ConsolidatedPatient, consolidatePatients } from '@/types/consolidated-patient';
import { useToast } from '@/hooks/use-toast';

export function usePatientSearch() {
  const [loading, setLoading] = useState(false);
  const [foundPatients, setFoundPatients] = useState<ConsolidatedPatient[]>([]);
  const { toast } = useToast();

  const searchPatients = useCallback(async (birthDate: string) => {
    if (!birthDate || birthDate.length !== 10) {
      setFoundPatients([]);
      return [];
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('data_nascimento', birthDate)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar pacientes:', error);
        throw error;
      }

      // Consolidar pacientes por nome_completo + data_nascimento
      const consolidatedPatients = consolidatePatients(data || []);

      setFoundPatients(consolidatedPatients);
      return consolidatedPatients;
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pacientes',
        variant: 'destructive',
      });
      setFoundPatients([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const searchPatientsByName = useCallback(async (name: string) => {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length < 3) {
      setFoundPatients([]);
      return [] as ConsolidatedPatient[];
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .ilike('nome_completo', `%${trimmed}%`)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('❌ Erro ao buscar pacientes por nome:', error);
        throw error;
      }

      const consolidatedPatients = consolidatePatients(data || []);

      setFoundPatients(consolidatedPatients);
      return consolidatedPatients as ConsolidatedPatient[];
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes por nome:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pacientes pelo nome',
        variant: 'destructive',
      });
      setFoundPatients([]);
      return [] as ConsolidatedPatient[];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const clearResults = useCallback(() => {
    setFoundPatients([]);
  }, []);

  return {
    loading,
    foundPatients,
    searchPatients,
    searchPatientsByName,
    clearResults
  };
}