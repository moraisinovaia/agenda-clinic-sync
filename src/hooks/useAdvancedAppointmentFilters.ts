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
    // 🔍 DIAGNÓSTICO: Log dos dados de entrada
    console.log('🔍 [FILTROS] Iniciando filtragem de agendamentos:', {
      totalAppointments: appointments.length,
      statusFilter,
      dateFilter,
      doctorFilter,
      convenioFilter,
      searchTerm,
      sampleAppointments: appointments.slice(0, 3).map(apt => ({
        id: apt.id,
        status: apt.status,
        data: apt.data_agendamento,
        paciente: apt.pacientes?.nome_completo
      }))
    });

    // CORRIGIDO: Só filtrar cancelados se statusFilter não for 'all'
    const baseFilter = statusFilter === 'all' 
      ? appointments // Mostra TODOS quando filter é 'all'
      : statusFilter === 'cancelado' || statusFilter === 'cancelado_bloqueio'
        ? appointments.filter(appointment => 
            appointment.status === 'cancelado' || appointment.status === 'cancelado_bloqueio'
          )
        : appointments.filter(appointment => 
            appointment.status !== 'cancelado' && 
            appointment.status !== 'cancelado_bloqueio'
          );

    console.log('🔍 [FILTROS] Após filtro base de status:', {
      original: appointments.length,
      afterBaseFilter: baseFilter.length,
      removed: appointments.length - baseFilter.length,
      statusFilter,
      statusCounts: {
        agendado: appointments.filter(a => a.status === 'agendado').length,
        confirmado: appointments.filter(a => a.status === 'confirmado').length,
        cancelado: appointments.filter(a => a.status === 'cancelado').length,
        cancelado_bloqueio: appointments.filter(a => a.status === 'cancelado_bloqueio').length,
      }
    });
    
    const filtered = baseFilter.filter(appointment => {
      // Search filter
      const matchesSearch = !searchTerm || 
        appointment.pacientes?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.medicos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appointment.atendimentos?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;

      // Date filter - CRÍTICO: Corrigido para timezone brasileiro
      let matchesDate = true;
      if (dateFilter !== 'all') {
        try {
          // Parse date in Brazilian timezone to avoid timezone issues
          const appointmentDateString = appointment.data_agendamento;
          const appointmentDate = toZonedTime(parseISO(appointmentDateString + 'T12:00:00'), BRAZIL_TIMEZONE);
          const today = toZonedTime(new Date(), BRAZIL_TIMEZONE);
          const todayStart = startOfDay(today);

          console.log('🔍 [FILTROS] Processando data:', {
            appointmentId: appointment.id,
            originalDate: appointmentDateString,
            parsedDate: appointmentDate.toISOString(),
            todayDate: today.toISOString(),
            dateFilter,
            paciente: appointment.pacientes?.nome_completo
          });

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

          if (!matchesDate) {
            console.log('🚫 [FILTROS] Agendamento filtrado por data:', {
              appointmentId: appointment.id,
              data: appointmentDateString,
              filtro: dateFilter,
              paciente: appointment.pacientes?.nome_completo
            });
          }
        } catch (error) {
          console.error('❌ [FILTROS] Erro ao processar data:', {
            appointmentId: appointment.id,
            data: appointment.data_agendamento,
            error: error.message
          });
          // Em caso de erro, manter o agendamento
          matchesDate = true;
        }
      } else {
        console.log('✅ [FILTROS] Filtro de data = "all", mantendo todos os agendamentos');
      }

      // Doctor filter
      const matchesDoctor = doctorFilter === 'all' || appointment.medico_id === doctorFilter;

      // Convenio filter
      const matchesConvenio = convenioFilter === 'all' || 
        appointment.pacientes?.convenio === convenioFilter;

      return matchesSearch && matchesStatus && matchesDate && matchesDoctor && matchesConvenio;
    });

    console.log('🔍 [FILTROS] Após todos os filtros:', {
      baseFilter: baseFilter.length,
      filtered: filtered.length,
      removed: baseFilter.length - filtered.length
    });

    return filtered;
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