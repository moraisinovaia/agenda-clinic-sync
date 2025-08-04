import { useState } from 'react';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';

export type ViewMode = 'doctors' | 'schedule' | 'new-appointment' | 'appointments-list' | 'edit-appointment' | 'preparos' | 'fila-espera' | 'nova-fila' | 'bloqueio-agenda' | 'relatorio-agenda' | 'auth-test' | 'alertas' | 'multiple-appointment' | 'canceled-appointments';

export const useViewMode = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('doctors');
  const [navigationHistory, setNavigationHistory] = useState<ViewMode[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [lastAppointmentDate, setLastAppointmentDate] = useState<string | null>(null);
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);

  // Função personalizada para setViewMode que limpa estados quando necessário
  const setViewModeWithCleanup = (newViewMode: ViewMode) => {
    // Adiciona a tela atual ao histórico antes de navegar
    if (viewMode !== newViewMode) {
      setNavigationHistory(prev => {
        const newHistory = [...prev, viewMode];
        // Mantém apenas as últimas 5 telas no histórico
        return newHistory.slice(-5);
      });
    }
    
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
    setNavigationHistory([]);
  };

  const goBack = () => {
    // Se estava editando, volta para a lista de agendamentos
    if (viewMode === 'edit-appointment') {
      setViewMode('appointments-list');
      setEditingAppointment(null);
      return;
    }
    
    // Usa o histórico para navegar de volta
    if (navigationHistory.length > 0) {
      const previousView = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1)); // Remove a última entrada do histórico
      setViewMode(previousView);
    } else {
      // Fallback para doctors se não há histórico
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