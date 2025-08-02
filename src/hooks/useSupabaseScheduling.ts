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

  // ✅ CORREÇÃO DEFINITIVA: Invalidar cache APENAS em caso de sucesso CONFIRMADO
  const createAppointment = useCallback(async (formData: any, editingAppointmentId?: string) => {
    console.log('🎯 useSupabaseScheduling: Iniciando createAppointment - SEM invalidar cache ainda');
    
    try {
      const result = await appointmentCreation.createAppointment(formData, editingAppointmentId);
      
      // ✅ VERIFICAR SE É REALMENTE SUCESSO antes de invalidar cache
      if (result && result.success !== false) {
        console.log('✅ Sucesso CONFIRMADO - agora sim invalidar cache');
        appointmentsList.invalidateCache?.();
        schedulingData.refetch();
        console.log('🔄 Cache invalidated only after CONFIRMED success');
      } else {
        console.log('⚠️ Resultado indefinido ou falha - NÃO invalidando cache');
      }
      
      return result;
    } catch (error) {
      console.log('❌ Erro capturado - PRESERVANDO cache e formulário:', error);
      throw error; // Repassar erro SEM afetar estado
    }
  }, [appointmentCreation.createAppointment, appointmentsList, schedulingData]);

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

  // ✅ MEMOIZAR: O objeto retornado para garantir referências estáveis
  return useMemo(() => ({
    // Dados
    doctors: schedulingData.doctors,
    atendimentos: schedulingData.atendimentos,
    appointments: appointmentsList.appointments,
    blockedDates: schedulingData.blockedDates,
    
    // Estados de loading - apenas dos dados essenciais
    loading: schedulingData.loading || patientManagement.loading || appointmentCreation.loading,
    
    // Operações - AGORA TODAS ESTÁVEIS
    createAppointment,
    cancelAppointment,
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