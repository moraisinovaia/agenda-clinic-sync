import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConsolidatedPatient } from '@/types/consolidated-patient';

export const useLastScheduledPatient = () => {
  const [loading, setLoading] = useState(false);
  const [lastPatient, setLastPatient] = useState<ConsolidatedPatient | null>(null);

  const fetchLastScheduledPatient = useCallback(async (): Promise<ConsolidatedPatient | null> => {
    setLoading(true);
    
    try {
      // Buscar o último agendamento com dados do paciente
      const { data: lastAppointment, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          convenio,
          paciente_id,
          pacientes!inner (
            id,
            nome_completo,
            data_nascimento,
            telefone,
            celular,
            convenio
          )
        `)
        .order('data_agendamento', { ascending: false })
        .order('hora_agendamento', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Nenhum agendamento encontrado
          toast.info('Nenhum agendamento encontrado no sistema');
          return null;
        }
        throw error;
      }

      if (!lastAppointment || !lastAppointment.pacientes) {
        toast.info('Nenhum paciente encontrado');
        return null;
      }

      // Consolidar dados do paciente com o último convênio usado
      const consolidatedPatient: ConsolidatedPatient = {
        id: lastAppointment.pacientes.id,
        nome_completo: lastAppointment.pacientes.nome_completo,
        data_nascimento: lastAppointment.pacientes.data_nascimento,
        telefone: lastAppointment.pacientes.telefone || '',
        celular: lastAppointment.pacientes.celular || '',
        ultimo_convenio: lastAppointment.convenio || lastAppointment.pacientes.convenio,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cliente_id: lastAppointment.pacientes.id // Usando o ID do paciente como fallback
      };

      setLastPatient(consolidatedPatient);
      return consolidatedPatient;

    } catch (error) {
      console.error('Erro ao buscar último paciente:', error);
      toast.error('Erro ao carregar dados do último paciente');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    lastPatient,
    fetchLastScheduledPatient
  };
};