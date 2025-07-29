import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

export function usePatientSearch() {
  const [loading, setLoading] = useState(false);
  const [foundPatients, setFoundPatients] = useState<Patient[]>([]);
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

      // Remover duplicatas
      const uniquePatients = data ? data.reduce((acc, current) => {
        const existing = acc.find(patient => 
          patient.nome_completo.toLowerCase() === current.nome_completo.toLowerCase() &&
          patient.convenio === current.convenio
        );
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, [] as typeof data) : [];

      setFoundPatients(uniquePatients);
      return uniquePatients;
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

  const clearResults = useCallback(() => {
    setFoundPatients([]);
  }, []);

  return {
    loading,
    foundPatients,
    searchPatients,
    clearResults
  };
}