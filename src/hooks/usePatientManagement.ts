import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { toast } from '@/components/ui/use-toast';

export function usePatientManagement() {
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<{ [key: string]: Patient[] }>({});

  // Buscar pacientes por data de nascimento (ESTABILIZADA - SEM dependências instáveis)
  const searchPatientsByBirthDate = useCallback(async (birthDate: string): Promise<Patient[]> => {
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

      // Remover duplicatas baseado no nome completo e convênio para evitar pacientes repetidos
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

      // Armazenar no cache
      cacheRef.current[birthDate] = uniquePatients;
      
      return uniquePatients;
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
  const searchPatientsByName = useCallback(async (name: string): Promise<Patient[]> => {
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

      const uniquePatients = data ? data.reduce((acc, current) => {
        const existing = acc.find(patient => 
          patient.nome_completo.toLowerCase() === current.nome_completo.toLowerCase() &&
          patient.convenio === current.convenio
        );
        if (!existing) acc.push(current);
        return acc;
      }, [] as typeof data) : [];

      cacheRef.current[cacheKey] = uniquePatients;
      return uniquePatients;
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