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

  // Função de recarregamento consolidada
  const refetch = async () => {
    await Promise.all([
      schedulingData.refetch(),
      appointmentsList.refetch(),
    ]);
  };

  // Envolver createAppointment para recarregar dados após sucesso
  const createAppointment = async (formData: any) => {
    try {
      const result = await appointmentCreation.createAppointment(formData);
      
      // Recarregar dados após sucesso
      await refetch();
      
      return result;
    } catch (error) {
      throw error; // Repassar erro para manter o formulário
    }
  };

  // Envolver cancelAppointment para usar a funcionalidade existente
  const cancelAppointment = async (appointmentId: string) => {
    try {
      await appointmentsList.cancelAppointment(appointmentId);
      // O refetch já é feito automaticamente no useAppointmentsList
    } catch (error) {
      throw error;
    }
  };

  // Envolver confirmAppointment para usar a funcionalidade existente
  const confirmAppointment = async (appointmentId: string) => {
    try {
      await appointmentsList.confirmAppointment(appointmentId);
      // O refetch já é feito automaticamente no useAppointmentsList
    } catch (error) {
      throw error;
    }
  };

  return {
    // Dados
    doctors: schedulingData.doctors,
    atendimentos: schedulingData.atendimentos,
    appointments: appointmentsList.appointments,
    blockedDates: schedulingData.blockedDates,
    
    // Estados de loading - apenas dos dados essenciais
    loading: schedulingData.loading || patientManagement.loading || appointmentCreation.loading,
    
    // Operações
    createAppointment,
    cancelAppointment,
    confirmAppointment,
    searchPatientsByBirthDate: patientManagement.searchPatientsByBirthDate,
    
    // Utilitários
    getAtendimentosByDoctor: schedulingData.getAtendimentosByDoctor,
    getAppointmentsByDoctorAndDate: appointmentsList.getAppointmentsByDoctorAndDate,
    isDateBlocked: schedulingData.isDateBlocked,
    getBlockedDatesByDoctor: schedulingData.getBlockedDatesByDoctor,
    
    // Recarregamento
    refetch,
  };
}