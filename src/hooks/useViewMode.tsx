import { useState } from 'react';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';

export type ViewMode = 'doctors' | 'schedule' | 'new-appointment' | 'appointments-list' | 'edit-appointment' | 'preparos' | 'fila-espera' | 'nova-fila' | 'bloqueio-agenda' | 'relatorio-agenda' | 'auth-test' | 'alertas' | 'multiple-appointment' | 'canceled-appointments' | 'simple-new';

export const useViewMode = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('doctors');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [lastAppointmentDate, setLastAppointmentDate] = useState<string | null>(null);
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);

  // Função personalizada para setViewMode que limpa estados quando necessário
  const setViewModeWithCleanup = (newViewMode: ViewMode) => {
    // Se está saindo do modo de edição, limpa o editingAppointment
    if (viewMode === 'edit-appointment' && newViewMode !== 'edit-appointment') {
      setEditingAppointment(null);
    }
    setViewMode(newViewMode);
  };

  const resetViewState = () => {
    setSelectedDoctor(null);
    setLastAppointmentDate(null);
    setSelectedAppointmentDate(null);
    setEditingAppointment(null);
  };

  const goBack = () => {
    // Se estava editando, volta para a lista de agendamentos
    if (viewMode === 'edit-appointment') {
      setViewMode('appointments-list');
      setEditingAppointment(null);
    } else {
      setViewMode('doctors');
      resetViewState();
    }
    // Limpar data de agendamento selecionada ao voltar
    setSelectedAppointmentDate(null);
  };

  const goBackToFilaEspera = () => {
    setViewMode('fila-espera');
  };

  return {
    viewMode,
    setViewMode: setViewModeWithCleanup,
    selectedDoctor,
    setSelectedDoctor,
    lastAppointmentDate,
    setLastAppointmentDate,
    selectedAppointmentDate,
    setSelectedAppointmentDate,
    editingAppointment,
    setEditingAppointment,
    resetViewState,
    goBack,
    goBackToFilaEspera
  };
};