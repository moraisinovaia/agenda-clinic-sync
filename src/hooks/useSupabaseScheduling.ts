import { useCallback, useMemo } from 'react';
import { useSchedulingData } from './useSchedulingData';
import { useAppointmentsList } from './useAppointmentsList';
import { usePatientManagement } from './usePatientManagement';
import { useAtomicAppointmentCreation } from './useAtomicAppointmentCreation';

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

  // ✅ CORREÇÃO DEFINITIVA: Invalidar cache SEMPRE após sucesso e garantir refetch
  const createAppointment = useCallback(async (formData: any, editingAppointmentId?: string, forceConflict = false) => {
    console.log('🌟🌟🌟 useSupabaseScheduling.createAppointment CHAMADO!', { formData, editingAppointmentId, forceConflict });
    
    try {
      console.log('📞 useSupabaseScheduling: Chamando appointmentCreation.createAppointment...');
      const result = await appointmentCreation.createAppointment(formData, editingAppointmentId, forceConflict);
      console.log('✨ useSupabaseScheduling: Resultado recebido:', result);
      
      // ✅ FASE 6: Se há sucesso, invalidar cache E forçar refetch IMEDIATO
      if (result && result.success !== false) {
        // Invalidar cache imediatamente
        appointmentsList.invalidateCache?.();
        
        // ✅ CORREÇÃO: Forçar refetch IMEDIATO (não esperar polling)
        await appointmentsList.refetch?.();
        console.log('✅ [SCHEDULING] Refetch imediato executado após criar agendamento');
      }
      
      return result;
    } catch (error) {
      throw error; // Repassar erro SEM afetar estado
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