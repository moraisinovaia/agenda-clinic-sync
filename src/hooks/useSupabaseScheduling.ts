import { useCallback, useMemo } from 'react';
import { useSchedulingData } from './useSchedulingData';
import { useAppointmentsList } from './useAppointmentsList';
import { usePatientManagement } from './usePatientManagement';
import { useAtomicAppointmentCreation } from './useAtomicAppointmentCreation';
import { useConnectionHealth } from './useConnectionHealth';

export function useSupabaseScheduling() {
  // Usar os hooks especializados
  const schedulingData = useSchedulingData();
  const appointmentsList = useAppointmentsList();
  const patientManagement = usePatientManagement();
  const appointmentCreation = useAtomicAppointmentCreation();
  const connectionHealth = useConnectionHealth();

  console.log('🎯 useSupabaseScheduling - doctors loaded:', schedulingData.doctors?.length || 0);
  console.log('🏥 Connection health:', connectionHealth.isHealthy ? 'HEALTHY' : 'UNHEALTHY');

  // ✅ ESTABILIZAR: Função de recarregamento consolidada
  const refetch = useCallback(async () => {
    await Promise.all([
      schedulingData.refetch(),
      appointmentsList.refetch(),
    ]);
  }, [schedulingData.refetch, appointmentsList.refetch]);

  // ✅ CORREÇÃO DEFINITIVA: Invalidar cache SEMPRE após sucesso e garantir refetch
  const createAppointment = useCallback(async (formData: any, editingAppointmentId?: string, forceConflict = false) => {
    console.log('🎯 useSupabaseScheduling: Iniciando createAppointment');
    console.log('📋 FormData recebido:', formData);
    
    try {
      const result = await appointmentCreation.createAppointment(formData, editingAppointmentId, forceConflict);
      console.log('📊 Resultado do createAppointment:', result);
      
      // ✅ Se há sucesso (mesmo que não explícito), invalidar cache
      if (result && result.success !== false) {
        console.log('✅ Sucesso CONFIRMADO - invalidando cache e refetch automático');
        
        // Invalidar cache imediatamente - o realtime fará o resto
        appointmentsList.invalidateCache?.();
        
        // Aguardar um pouco para o realtime processar
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('🔄 Cache invalidado - realtime updates farão o refetch automático');
      } else {
        console.log('⚠️ Resultado indefinido ou falha - NÃO invalidando cache');
        console.log('🔍 Result details:', JSON.stringify(result, null, 2));
      }
      
      return result;
    } catch (error) {
      console.log('❌ Erro capturado - PRESERVANDO cache e formulário:', error);
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

  // ✅ MEMOIZAR: O objeto retornado para garantir referências estáveis
  return useMemo(() => ({
    // Dados
    doctors: schedulingData.doctors,
    atendimentos: schedulingData.atendimentos,
    appointments: appointmentsList.appointments,
    blockedDates: schedulingData.blockedDates,
    
    // Estados de loading - apenas dos dados essenciais (NÃO incluir loading de criação para não desmontar a tela durante submissão)
    loading: schedulingData.loading || patientManagement.loading,
    
    // Connection health
    connectionHealth,
    isHealthy: connectionHealth.isHealthy,
    
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
    // Connection health
    connectionHealth,
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