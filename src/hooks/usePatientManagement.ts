import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';

export function usePatientManagement() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Buscar pacientes por data de nascimento
  const searchPatientsByBirthDate = async (birthDate: string): Promise<Patient[]> => {
    try {
      setLoading(true);
      console.log('🔍 Buscando pacientes por data de nascimento:', birthDate);
      
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

      console.log('📋 Pacientes únicos encontrados:', uniquePatients);
      return uniquePatients;
    } catch (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar os pacientes',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    searchPatientsByBirthDate,
  };
}