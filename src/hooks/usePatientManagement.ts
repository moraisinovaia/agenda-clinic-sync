import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { ConsolidatedPatient, consolidatePatients } from '@/types/consolidated-patient';
import { toast } from '@/components/ui/use-toast';

export function usePatientManagement() {
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<{ [key: string]: ConsolidatedPatient[] }>({});

  // Buscar pacientes por data de nascimento (ESTABILIZADA - SEM dependências instáveis)
  const searchPatientsByBirthDate = useCallback(async (birthDate: string): Promise<ConsolidatedPatient[]> => {
    if (!birthDate || birthDate.length !== 10) {
      return [];
    }
    
    // Verificar cache para evitar buscas duplicadas
    if (cacheRef.current[birthDate]) {
      return cacheRef.current[birthDate];
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

      // Armazenar no cache
      cacheRef.current[birthDate] = consolidatedPatients;
      
      return consolidatedPatients;
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      // Usar toast diretamente sem colocar nas dependências
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pacientes',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, []); // SEM dependências - função completamente estável

  // Buscar pacientes por nome (mín. 3 caracteres)
  const searchPatientsByName = useCallback(async (name: string): Promise<ConsolidatedPatient[]> => {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length < 3) return [];

    const cacheKey = `name:${trimmed.toLowerCase()}`;
    if (cacheRef.current[cacheKey]) {
      return cacheRef.current[cacheKey];
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

      cacheRef.current[cacheKey] = consolidatedPatients;
      return consolidatedPatients;
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes por nome:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pacientes pelo nome',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    searchPatientsByBirthDate,
    searchPatientsByName,
  };
}