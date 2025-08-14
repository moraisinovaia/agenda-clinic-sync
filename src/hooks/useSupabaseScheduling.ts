import { useCallback, useMemo } from 'react';
import { useSchedulingData } from './useSchedulingData';
import { useAppointmentsList } from './useAppointmentsList';
import { usePatientManagement } from './usePatientManagement';
import { useAtomicAppointmentCreation } from './useAtomicAppointmentCreation';
import { useCriticalDataFetch } from './useCriticalDataFetch';
import { clearAllCache } from './useOptimizedQuery';

export function useSupabaseScheduling() {
  // Usar os hooks especializados
  const schedulingData = useSchedulingData();
  const appointmentsList = useAppointmentsList();
  const patientManagement = usePatientManagement();
  const appointmentCreation = useAtomicAppointmentCreation();
  const criticalDataFetch = useCriticalDataFetch();

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

  // 🔧 SUPER AGRESSIVO: Limpar TUDO após criação de agendamento
  const createAppointment = useCallback(async (formData: any, editingAppointmentId?: string, forceConflict = false) => {
    console.log('🎯 useSupabaseScheduling: Iniciando createAppointment');
    console.log('📋 FormData recebido:', formData);
    
    try {
      const result = await appointmentCreation.createAppointment(formData, editingAppointmentId, forceConflict);
      console.log('📊 Resultado do createAppointment:', result);
      
      // ✅ Se há sucesso (mesmo que não explícito), DESTRUIR TUDO
      if (result && result.success !== false) {
        console.log('🚨 SUCESSO CONFIRMADO - DESTRUINDO TODO O CACHE!');
        
        // 1. Limpar TODO o cache do sistema
        clearAllCache();
        console.log('💥 Cache TOTALMENTE destruído');
        
        // 2. Aguardar para garantir que dados foram persistidos
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 3. Buscar dados críticos diretamente do banco
        const freshData = await criticalDataFetch.fetchAppointmentsCritical();
        console.log('🔥 Dados críticos buscados diretamente do banco:', freshData.length, 'agendamentos');
        
        // 4. Forçar refetch de tudo
        await Promise.all([
          schedulingData.refetch(),
          appointmentsList.forceRefetch()
        ]);
        
        console.log('✅ REFRESH COMPLETO - agendamentos devem aparecer IMEDIATAMENTE');
      } else {
        console.log('⚠️ Resultado indefinido ou falha - NÃO invalidando cache');
        console.log('🔍 Result details:', JSON.stringify(result, null, 2));
      }
      
      return result;
    } catch (error) {
      console.log('❌ Erro capturado - PRESERVANDO cache e formulário:', error);
      throw error; // Repassar erro SEM afetar estado
    }
  }, [appointmentCreation.createAppointment, appointmentsList, schedulingData, criticalDataFetch]);

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

  // 🔧 FUNÇÃO DE TESTE: Criar agendamento para novembro 2025
  const createTestAppointment = useCallback(async () => {
    console.log('🧪 TESTE: Criando agendamento para novembro 2025...');
    
    const testData = {
      nomeCompleto: 'TESTE NOVEMBRO 2025',
      dataNascimento: '1990-01-01',
      convenio: 'Particular',
      telefone: '11999999999',
      celular: '11999999999',
      medicoId: 'b9e24f79-d5b7-4b12-8c2b-9b4d8a6c5e3f', // Dr. Edson
      atendimentoId: '2e5c4a8b-7f3d-4b9e-a2c1-6d8f9e0a1b2c', // Consulta
      dataAgendamento: '2025-11-15',
      horaAgendamento: '10:00',
      observacoes: 'TESTE - Verificar se aparece imediatamente na interface'
    };
    
    try {
      const result = await createAppointment(testData);
      console.log('🧪 TESTE RESULTADO:', result);
      
      // Aguardar um pouco e validar se apareceu
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const novemberAppointments = appointmentsList.appointments.filter(apt => 
        apt.data_agendamento >= '2025-11-01' && apt.data_agendamento <= '2025-11-30'
      );
      
      console.log('🧪 TESTE VALIDAÇÃO:', {
        novemberAppointments: novemberAppointments.length,
        testFound: novemberAppointments.some(apt => apt.pacientes?.nome_completo?.includes('TESTE NOVEMBRO'))
      });
      
      return result;
    } catch (error) {
      console.error('🧪 TESTE FALHOU:', error);
      throw error;
    }
  }, [createAppointment, appointmentsList.appointments]);

  // 🔍 DEBUG: Force refresh function para debug
  const forceRefresh = useCallback(async () => {
    console.log('🔍 DEBUG - Forcing complete refresh of all data');
    clearAllCache();
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
    
    // 🧪 TESTE: Função para criar agendamento de teste
    createTestAppointment,
    
    // 🔧 CRÍTICO: Validação de dados
    validateDataConsistency: criticalDataFetch.validateDataConsistency,
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
    createTestAppointment,
    criticalDataFetch.validateDataConsistency,
  ]);
}