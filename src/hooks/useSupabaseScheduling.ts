import { useCallback, useMemo } from 'react';
import { useSchedulingData } from './useSchedulingData';
import { useAppointmentsList } from './useAppointmentsList';
import { usePatientManagement } from './usePatientManagement';
import { useAtomicAppointmentCreation } from './useAtomicAppointmentCreation';
import { supabase } from '@/integrations/supabase/client';

export function useSupabaseScheduling() {
  // Usar os hooks especializados
  const schedulingData = useSchedulingData();
  const appointmentsList = useAppointmentsList();
  const patientManagement = usePatientManagement();
  const appointmentCreation = useAtomicAppointmentCreation();

  // ✅ ESTABILIZAR: Função de recarregamento consolidada
  const refetch = useCallback(async () => {
    await Promise.all([
      schedulingData.refetch(),
      appointmentsList.refetch(),
    ]);
  }, [schedulingData.refetch, appointmentsList.refetch]);

  // ⚡ OTIMIZAÇÃO FASE 9: Update otimista INSTANTÂNEO - sem refetch pesado
  const createAppointment = useCallback(async (formData: any, editingAppointmentId?: string, forceConflict = false) => {
    console.log('🌟 useSupabaseScheduling.createAppointment CHAMADO');
    
    try {
      const result = await appointmentCreation.createAppointment(formData, editingAppointmentId, forceConflict);
      
      // ⚡ FASE 9: Update otimista instantâneo - buscar apenas o novo agendamento (1 registro)
      if (result && result.success !== false && result.agendamento_id) {
        console.log('⚡ [OPTIMISTIC] Buscando apenas o novo agendamento...');
        
        const { data: newAppointmentData } = await supabase
          .from('agendamentos')
          .select(`
            *,
            pacientes!inner(id, nome_completo, convenio, celular, telefone, data_nascimento),
            medicos!inner(id, nome, especialidade, ativo),
            atendimentos!inner(id, nome, tipo, medico_id)
          `)
          .eq('id', result.agendamento_id)
          .single();
        
        if (newAppointmentData) {
          console.log('⚡ [OPTIMISTIC] Adicionando localmente para feedback instantâneo');
          appointmentsList.addAppointmentLocally?.({
            ...newAppointmentData,
            pacientes: newAppointmentData.pacientes || null,
            medicos: newAppointmentData.medicos || null,
            atendimentos: newAppointmentData.atendimentos || null,
          } as any);
        }
        
        // ⚡ FASE 9: Invalidar cache mas NÃO fazer refetch automático
        // O polling a cada 10s vai sincronizar naturalmente
        appointmentsList.invalidateCache?.();
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }, [appointmentCreation.createAppointment, appointmentsList]);

  // ✅ ESTABILIZAR: Envolver cancelAppointment para usar a funcionalidade existente
  const cancelAppointment = useCallback(async (appointmentId: string) => {
    try {
      await appointmentsList.cancelAppointment(appointmentId);
      // O refetch já é feito automaticamente no useAppointmentsList
    } catch (error) {
      throw error;
    }
  }, [appointmentsList.cancelAppointment]);

  // ✅ ESTABILIZAR: Envolver confirmAppointment para usar a funcionalidade existente
  const confirmAppointment = useCallback(async (appointmentId: string) => {
    try {
      await appointmentsList.confirmAppointment(appointmentId);
      // O refetch já é feito automaticamente no useAppointmentsList
    } catch (error) {
      throw error;
    }
  }, [appointmentsList.confirmAppointment]);

  // ✅ ESTABILIZAR: Envolver unconfirmAppointment para usar a funcionalidade existente
  const unconfirmAppointment = useCallback(async (appointmentId: string) => {
    try {
      await appointmentsList.unconfirmAppointment(appointmentId);
      // O refetch já é feito automaticamente no useAppointmentsList
    } catch (error) {
      throw error;
    }
  }, [appointmentsList.unconfirmAppointment]);

  const deleteAppointment = useCallback(async (appointmentId: string) => {
    try {
      await appointmentsList.deleteAppointment(appointmentId);
      // O refetch já é feito automaticamente no useAppointmentsList
    } catch (error) {
      throw error;
    }
  }, [appointmentsList.deleteAppointment]);

  // ✅ MEMOIZAR: O objeto retornado para garantir referências estáveis
  return useMemo(() => ({
    // Dados
    doctors: schedulingData.doctors,
    atendimentos: schedulingData.atendimentos,
    appointments: appointmentsList.appointments,
    blockedDates: schedulingData.blockedDates,
    
    // Estados de loading - apenas dos dados essenciais (NÃO incluir loading de criação para não desmontar a tela durante submissão)
    loading: schedulingData.loading || patientManagement.loading,
    
    // Operações - AGORA TODAS ESTÁVEIS
    createAppointment,
    cancelAppointment,
    deleteAppointment,
    confirmAppointment,
    unconfirmAppointment,
    searchPatientsByBirthDate: patientManagement.searchPatientsByBirthDate, // ✅ JÁ ESTÁVEL
    
    // Utilitários
    getAtendimentosByDoctor: schedulingData.getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate: appointmentsList.getAppointmentsByDoctorAndDate,
    isDateBlocked: schedulingData.isDateBlocked,
    getBlockedDatesByDoctor: schedulingData.getBlockedDatesByDoctor,
    
    // Recarregamento - ✅ EXPOR PARA COMPONENTES EXTERNOS
    refetch,
  }), [
    // Dados
    schedulingData.doctors,
    schedulingData.atendimentos,
    appointmentsList.appointments,
    schedulingData.blockedDates,
    // Estados
    schedulingData.loading,
    patientManagement.loading,
    appointmentCreation.loading,
    // Funções estáveis
    createAppointment,
    cancelAppointment,
    deleteAppointment,
    confirmAppointment,
    unconfirmAppointment,
    patientManagement.searchPatientsByBirthDate,
    schedulingData.getAtendimentosByDoctor,
    appointmentsList.getAppointmentsByDoctorAndDate,
    schedulingData.isDateBlocked,
    schedulingData.getBlockedDatesByDoctor,
    refetch,
  ]);
}