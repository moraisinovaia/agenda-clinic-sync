import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConsolidatedPatient } from '@/types/consolidated-patient';

export const useLastScheduledPatient = () => {
  const [loading, setLoading] = useState(false);
  const [lastPatient, setLastPatient] = useState<ConsolidatedPatient | null>(null);

  const fetchLastScheduledPatient = useCallback(async (): Promise<ConsolidatedPatient | null> => {
    if (loading) {
      console.log('⏳ Busca do último paciente já em andamento...');
      return null;
    }

    setLoading(true);
    
    try {
      console.log('🔍 Buscando último paciente agendado...');
      
      // Buscar o último agendamento com dados do paciente
      const { data: lastAppointment, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          convenio,
          paciente_id,
          data_agendamento,
          hora_agendamento,
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
          console.log('ℹ️ Nenhum agendamento encontrado no sistema');
          toast.info('Nenhum agendamento encontrado no sistema');
          setLastPatient(null);
          return null;
        }
        console.error('❌ Erro na consulta do último paciente:', error);
        throw error;
      }

      if (!lastAppointment || !lastAppointment.pacientes) {
        console.log('ℹ️ Nenhum paciente encontrado');
        toast.info('Nenhum paciente encontrado');
        setLastPatient(null);
        return null;
      }

      console.log('✅ Último paciente encontrado:', {
        nome: lastAppointment.pacientes.nome_completo,
        data: lastAppointment.data_agendamento,
        hora: lastAppointment.hora_agendamento
      });

      // Consolidar dados do paciente com o último convênio usado e tratamento de erro
      let consolidatedPatient: ConsolidatedPatient;
      try {
        consolidatedPatient = {
          id: lastAppointment.pacientes.id,
          nome_completo: lastAppointment.pacientes.nome_completo || '',
          data_nascimento: lastAppointment.pacientes.data_nascimento || '',
          telefone: lastAppointment.pacientes.telefone || '',
          celular: lastAppointment.pacientes.celular || '',
          ultimo_convenio: lastAppointment.convenio || lastAppointment.pacientes.convenio || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          cliente_id: lastAppointment.pacientes.id // Usando o ID do paciente como fallback
        };
      } catch (consolidationError) {
        console.error('❌ Erro ao consolidar dados do paciente:', consolidationError);
        // Fallback: dados mínimos
        consolidatedPatient = {
          id: '',
          nome_completo: lastAppointment.pacientes.nome_completo || '',
          data_nascimento: lastAppointment.pacientes.data_nascimento || '',
          telefone: lastAppointment.pacientes.telefone || '',
          celular: lastAppointment.pacientes.celular || '',
          ultimo_convenio: lastAppointment.convenio || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          cliente_id: ''
        };
      }

      setLastPatient(consolidatedPatient);
      return consolidatedPatient;

    } catch (error) {
      console.error('❌ Erro ao buscar último paciente:', error);
      toast.error('Erro ao carregar dados do último paciente');
      setLastPatient(null);
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