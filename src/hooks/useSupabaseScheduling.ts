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

  // ✅ ESTABILIZAR: Função de recarregamento consolidada com invalidação de cache
  const refetch = useCallback(async () => {
    console.log('🔄 useSupabaseScheduling: Iniciando refetch consolidado');
    console.log('🚨 FORÇANDO INVALIDAÇÃO COMPLETA DO CACHE!');
    
    // Invalidar caches antes do refetch
    appointmentsList.invalidateCache();
    
    // Aguardar um pouco para garantir limpeza do cache
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await Promise.all([
      appointmentsList.forceRefetch(),
      schedulingData.refetch(),
    ]);
  }, [schedulingData.refetch, appointmentsList.refetch, appointmentsList.invalidateCache, appointmentsList.forceRefetch]);

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
        
        // Invalidar cache E fazer refetch para garantir dados atualizados
        appointmentsList.invalidateCache?.();
        await schedulingData.refetch();
        await appointmentsList.refetch();
        
        console.log('🔄 Cache invalidated and data refreshed - appointments should now be visible');
      } else {
        console.log('⚠️ Resultado indefinido ou falha - NÃO invalidando cache');
        console.log('🔍 Result details:', JSON.stringify(result, null, 2));
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

  // 🔍 DEBUG: Force refresh function para debug
  const forceRefresh = useCallback(async () => {
    console.log('🔍 DEBUG - Forcing complete refresh of all data');
    await Promise.all([
      appointmentsList.forceRefetch(),
      schedulingData.refetch()
    ]);
    console.log('🔍 DEBUG - Force refresh completed');
  }, [appointmentsList.forceRefetch, schedulingData.refetch]);

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
    confirmAppointment,
    unconfirmAppointment,
    searchPatientsByBirthDate: patientManagement.searchPatientsByBirthDate, // ✅ JÁ ESTÁVEL
    
    // Utilitários
    getAtendimentosByDoctor: schedulingData.getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate: appointmentsList.getAppointmentsByDoctorAndDate,
    isDateBlocked: schedulingData.isDateBlocked,
    getBlockingReason: schedulingData.getBlockingReason,
    getBlockedDatesByDoctor: schedulingData.getBlockedDatesByDoctor,
    
    // Recarregamento - ✅ EXPOR PARA COMPONENTES EXTERNOS
    refetch,
    forceRefresh,
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
    schedulingData.getBlockingReason,
    schedulingData.getBlockedDatesByDoctor,
    refetch,
    forceRefresh,
  ]);
}