import { useState, useMemo } from 'react';
import { AppointmentWithRelations } from '@/types/scheduling';
import { 
  isToday, 
  isTomorrow, 
  isThisWeek, 
  isThisMonth, 
  isBefore, 
  isAfter,
  startOfDay,
  parseISO 
} from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { BRAZIL_TIMEZONE } from '@/utils/timezone';

export const useAdvancedAppointmentFilters = (appointments: AppointmentWithRelations[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [convenioFilter, setConvenioFilter] = useState('all');

  const filteredAppointments = useMemo(() => {
    // ✅ SIMPLIFICADO: Filtragem limpa e eficiente
    return appointments.filter(appointment => {
      // Search filter
      const matchesSearch = !searchTerm || 
        appointment.pacientes?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.medicos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.atendimentos?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter - ✅ CORRIGIDO: 'all' mostra TODOS os agendamentos
      const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        try {
          const appointmentDateString = appointment.data_agendamento;
          const appointmentDate = toZonedTime(parseISO(appointmentDateString + 'T12:00:00'), BRAZIL_TIMEZONE);
          const today = toZonedTime(new Date(), BRAZIL_TIMEZONE);
          const todayStart = startOfDay(today);

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
              matchesDate = isAfter(appointmentDate, todayStart);
              break;
            case 'past':
              matchesDate = isBefore(appointmentDate, todayStart);
              break;
            default:
              matchesDate = true;
          }
        } catch (error) {
          console.error('❌ [FILTROS] Erro ao processar data:', appointment.data_agendamento);
          matchesDate = true;
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