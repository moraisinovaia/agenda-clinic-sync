import { useState } from 'react';
import { Doctor, AppointmentWithRelations } from '@/types/scheduling';

export type ViewMode = 'doctors' | 'schedule' | 'new-appointment' | 'appointments-list' | 'edit-appointment' | 'preparos' | 'fila-espera' | 'nova-fila' | 'bloqueio-agenda' | 'relatorio-agenda' | 'auth-test' | 'alertas';

export const useViewMode = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('doctors');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [lastAppointmentDate, setLastAppointmentDate] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithRelations | null>(null);

  const resetViewState = () => {
    setSelectedDoctor(null);
    setLastAppointmentDate(null);
    setEditingAppointment(null);
  };

  const goBack = () => {
    setViewMode('doctors');
    resetViewState();
  };

  const goBackToFilaEspera = () => {
    setViewMode('fila-espera');
  };

  return {
    viewMode,
    setViewMode,
    selectedDoctor,
    setSelectedDoctor,
    lastAppointmentDate,
    setLastAppointmentDate,
    editingAppointment,
    setEditingAppointment,
    resetViewState,
    goBack,
    goBackToFilaEspera
  };
};