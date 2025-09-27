import { useState, useMemo } from 'react';
import { AppointmentWithRelations } from '@/types/scheduling';
import { 
  isToday, 
  isTomorrow, 
  isThisWeek, 
  isThisMonth, 
  isBefore, 
  isAfter,
  startOfDay 
} from 'date-fns';

export const useAdvancedAppointmentFilters = (appointments: AppointmentWithRelations[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [convenioFilter, setConvenioFilter] = useState('all');

  const filteredAppointments = useMemo(() => {
    // Separar agendamentos cancelados e excluídos por padrão
    const baseFilter = statusFilter === 'cancelado' || statusFilter === 'cancelado_bloqueio' || statusFilter === 'excluido'
      ? appointments 
      : appointments.filter(appointment => 
          appointment.status !== 'cancelado' && 
          appointment.status !== 'cancelado_bloqueio' &&
          appointment.status !== 'excluido'
        );
    
    return baseFilter.filter(appointment => {
      // Search filter
      const matchesSearch = !searchTerm || 
        appointment.pacientes?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.medicos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.atendimentos?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        // Fix timezone issue by ensuring date is parsed in local timezone
        const appointmentDate = new Date(appointment.data_agendamento + 'T00:00:00');
        const today = startOfDay(new Date());

        switch (dateFilter) {
          case 'today':
            matchesDate = isToday(appointmentDate);
            break;
          case 'tomorrow':
            matchesDate = isTomorrow(appointmentDate);
            break;
          case 'week':
            matchesDate = isThisWeek(appointmentDate, { weekStartsOn: 0 });
            break;
          case 'month':
            matchesDate = isThisMonth(appointmentDate);
            break;
          case 'future':
            matchesDate = isAfter(appointmentDate, today);
            break;
          case 'past':
            matchesDate = isBefore(appointmentDate, today);
            break;
        }
      }

      // Doctor filter
      const matchesDoctor = doctorFilter === 'all' || appointment.medico_id === doctorFilter;

      // Convenio filter
      const matchesConvenio = convenioFilter === 'all' || 
        appointment.pacientes?.convenio === convenioFilter;

      return matchesSearch && matchesStatus && matchesDate && matchesDoctor && matchesConvenio;
    });
  }, [appointments, searchTerm, statusFilter, dateFilter, doctorFilter, convenioFilter]);

  const sortedAppointments = useMemo(() => {
    return filteredAppointments.sort((a, b) => {
      const dateA = new Date(`${a.data_agendamento}T${a.hora_agendamento}`);
      const dateB = new Date(`${b.data_agendamento}T${b.hora_agendamento}`);
      
      // Sort by date/time ascending (nearest first)
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredAppointments]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('all');
    setDoctorFilter('all');
    setConvenioFilter('all');
  };

  const getFilterStats = () => {
    const total = appointments.length;
    const filtered = filteredAppointments.length;
    const activeFilters = [
      searchTerm,
      statusFilter !== 'all' ? statusFilter : null,
      dateFilter !== 'all' ? dateFilter : null,
      doctorFilter !== 'all' ? doctorFilter : null,
      convenioFilter !== 'all' ? convenioFilter : null,
    ].filter(Boolean).length;

    return { total, filtered, activeFilters };
  };

  return {
    // State
    searchTerm,
    statusFilter,
    dateFilter,
    doctorFilter,
    convenioFilter,
    
    // Setters
    setSearchTerm,
    setStatusFilter,
    setDateFilter,
    setDoctorFilter,
    setConvenioFilter,
    
    // Results
    filteredAppointments: sortedAppointments,
    
    // Utils
    clearFilters,
    getFilterStats,
  };
};