import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';

interface ServerSideFilters {
  searchTerm?: string;
  statusFilter?: string;
  dateFilter?: string;
  doctorFilter?: string;
  convenioFilter?: string;
  startDate?: string;
  endDate?: string;
}

interface PaginationConfig {
  page: number;
  itemsPerPage: number;
}

export function useServerSideAppointmentsList() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationConfig>({ page: 1, itemsPerPage: 50 });
  const [filters, setFilters] = useState<ServerSideFilters>({});
  const [error, setError] = useState<Error | null>(null);

  // Build query with server-side filters
  const buildQuery = useCallback((filters: ServerSideFilters, paginationConfig: PaginationConfig) => {
    let query = supabase
      .from('agendamentos')
      .select(`
        *,
        pacientes!inner(
          id,
          nome_completo,
          data_nascimento,
          convenio,
          telefone,
          celular
        ),
        medicos!inner(
          id,
          nome,
          especialidade
        ),
        atendimentos!inner(
          id,
          nome,
          tipo
        )
      `, { count: 'exact' });

    // Apply server-side filters
    if (filters.searchTerm) {
      query = query.or(`pacientes.nome_completo.ilike.%${filters.searchTerm}%,medicos.nome.ilike.%${filters.searchTerm}%,atendimentos.nome.ilike.%${filters.searchTerm}%`);
    }

    if (filters.statusFilter && filters.statusFilter !== 'all') {
      query = query.eq('status', filters.statusFilter);
    }

    if (filters.doctorFilter && filters.doctorFilter !== 'all') {
      query = query.eq('medico_id', filters.doctorFilter);
    }

    if (filters.convenioFilter && filters.convenioFilter !== 'all') {
      query = query.eq('pacientes.convenio', filters.convenioFilter);
    }

    if (filters.startDate) {
      query = query.gte('data_agendamento', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('data_agendamento', filters.endDate);
    }

    // Apply date filters
    if (filters.dateFilter && filters.dateFilter !== 'all') {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      switch (filters.dateFilter) {
        case 'today':
          query = query.eq('data_agendamento', today);
          break;
        case 'tomorrow':
          query = query.eq('data_agendamento', tomorrow);
          break;
        case 'future':
          query = query.gt('data_agendamento', today);
          break;
        case 'past':
          query = query.lt('data_agendamento', today);
          break;
      }
    }

    // Apply pagination
    const startIndex = (paginationConfig.page - 1) * paginationConfig.itemsPerPage;
    const endIndex = startIndex + paginationConfig.itemsPerPage - 1;
    
    query = query
      .order('data_agendamento', { ascending: false })
      .order('hora_agendamento', { ascending: false })
      .range(startIndex, endIndex);

    return query;
  }, []);

  // Fetch appointments with server-side filtering and pagination
  const fetchAppointments = useCallback(async (newFilters?: ServerSideFilters, newPagination?: Partial<PaginationConfig>) => {
    setLoading(true);
    setError(null);

    const currentFilters = newFilters ? { ...filters, ...newFilters } : filters;
    const currentPagination = newPagination ? { ...pagination, ...newPagination } : pagination;

    try {
      const startTime = performance.now();
      
      const query = buildQuery(currentFilters, currentPagination);
      const { data, error: queryError, count } = await query;

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      if (queryError) {
        throw queryError;
      }

      // Transform data
      const transformedAppointments: AppointmentWithRelations[] = (data || []).map((apt) => ({
        id: apt.id,
        paciente_id: apt.paciente_id,
        medico_id: apt.medico_id,
        atendimento_id: apt.atendimento_id,
        data_agendamento: apt.data_agendamento,
        hora_agendamento: apt.hora_agendamento,
        status: apt.status,
        observacoes: apt.observacoes,
        created_at: apt.created_at,
        updated_at: apt.updated_at,
        criado_por: apt.criado_por,
        criado_por_user_id: apt.criado_por_user_id,
        cancelado_em: apt.cancelado_em,
        cancelado_por: apt.cancelado_por,
        cancelado_por_user_id: apt.cancelado_por_user_id,
        confirmado_em: apt.confirmado_em,
        confirmado_por: apt.confirmado_por,
        confirmado_por_user_id: apt.confirmado_por_user_id,
        convenio: apt.convenio,
        pacientes: apt.pacientes ? {
          id: apt.pacientes.id,
          nome_completo: apt.pacientes.nome_completo,
          convenio: apt.pacientes.convenio,
          celular: apt.pacientes.celular,
          telefone: apt.pacientes.telefone || '',
          data_nascimento: apt.pacientes.data_nascimento || '',
          created_at: '',
          updated_at: ''
        } : null,
        medicos: apt.medicos ? {
          id: apt.medicos.id,
          nome: apt.medicos.nome,
          especialidade: apt.medicos.especialidade,
          ativo: true,
          crm: '',
          created_at: '',
          updated_at: '',
          convenios_aceitos: [],
          convenios_restricoes: null,
          horarios: null,
          idade_maxima: null,
          idade_minima: null,
          observacoes: ''
        } : null,
        atendimentos: apt.atendimentos ? {
          id: apt.atendimentos.id,
          nome: apt.atendimentos.nome,
          tipo: apt.atendimentos.tipo,
          ativo: true,
          medico_id: apt.medico_id,
          medico_nome: apt.medicos?.nome || '',
          created_at: '',
          updated_at: '',
          codigo: '',
          coparticipacao_unimed_20: 0,
          coparticipacao_unimed_40: 0,
          forma_pagamento: 'convenio',
          horarios: null,
          observacoes: '',
          valor_convenio: 0,
          valor_particular: 0,
          restricoes: null
        } : null
      }));

      setAppointments(transformedAppointments);
      setTotalCount(count || 0);
      setFilters(currentFilters);
      setPagination(currentPagination);

      // Performance logging
      logger.info('Server-side query completed', {
        filters: currentFilters,
        page: currentPagination.page,
        itemsPerPage: currentPagination.itemsPerPage,
        resultCount: transformedAppointments.length,
        totalCount: count,
        queryTime: `${queryTime.toFixed(2)}ms`
      }, 'APPOINTMENTS_SERVER_SIDE');

      // Performance warning if query is slow
      if (queryTime > 2000) {
        logger.warn('Slow query detected', { queryTime: `${queryTime.toFixed(2)}ms` }, 'PERFORMANCE');
        toast({
          title: 'Performance',
          description: 'A consulta demorou mais que o esperado. Considere refinar os filtros.',
          variant: 'default',
        });
      }

    } catch (error) {
      logger.error('Error fetching appointments', error, 'APPOINTMENTS_SERVER_SIDE');
      setError(error as Error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filters, pagination, buildQuery, toast]);

  // Update filters with immediate refetch
  const updateFilters = useCallback((newFilters: ServerSideFilters) => {
    fetchAppointments(newFilters, { page: 1 }); // Reset to page 1 when filtering
  }, [fetchAppointments]);

  // Change page
  const changePage = useCallback((page: number) => {
    fetchAppointments(undefined, { page });
  }, [fetchAppointments]);

  // Change items per page
  const changeItemsPerPage = useCallback((itemsPerPage: number) => {
    fetchAppointments(undefined, { page: 1, itemsPerPage });
  }, [fetchAppointments]);

  // Refresh data
  const refresh = useCallback(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Clear filters
  const clearFilters = useCallback(() => {
    updateFilters({});
  }, [updateFilters]);

  // Calculated pagination values
  const totalPages = Math.ceil(totalCount / pagination.itemsPerPage);
  const hasNextPage = pagination.page < totalPages;
  const hasPreviousPage = pagination.page > 1;
  const startItem = (pagination.page - 1) * pagination.itemsPerPage + 1;
  const endItem = Math.min(pagination.page * pagination.itemsPerPage, totalCount);

  // Appointment management functions
  const cancelAppointment = useCallback(async (appointmentId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, user_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase.rpc('cancelar_agendamento_soft', {
        p_agendamento_id: appointmentId,
        p_cancelado_por: profile?.nome || 'Usuário',
        p_cancelado_por_user_id: profile?.user_id || null
      });

      if (error) throw error;
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error || 'Erro ao cancelar agendamento');
      }

      toast({
        title: 'Agendamento cancelado',
        description: 'O agendamento foi cancelado com sucesso',
      });

      refresh();
    } catch (error) {
      logger.error('Error canceling appointment', error, 'APPOINTMENTS_SERVER_SIDE');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível cancelar o agendamento',
        variant: 'destructive',
      });
    }
  }, [refresh, toast]);

  const confirmAppointment = useCallback(async (appointmentId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, user_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase.rpc('confirmar_agendamento', {
        p_agendamento_id: appointmentId,
        p_confirmado_por: profile?.nome || 'Usuário',
        p_confirmado_por_user_id: profile?.user_id || null
      });

      if (error) throw error;
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error || 'Erro ao confirmar agendamento');
      }

      toast({
        title: 'Agendamento confirmado',
        description: 'O agendamento foi confirmado com sucesso',
      });

      refresh();
    } catch (error) {
      logger.error('Error confirming appointment', error, 'APPOINTMENTS_SERVER_SIDE');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível confirmar o agendamento',
        variant: 'destructive',
      });
    }
  }, [refresh, toast]);

  const unconfirmAppointment = useCallback(async (appointmentId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, user_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data, error } = await supabase.rpc('desconfirmar_agendamento', {
        p_agendamento_id: appointmentId,
        p_desconfirmado_por: profile?.nome || 'Usuário',
        p_desconfirmado_por_user_id: profile?.user_id || null
      });

      if (error) throw error;
      if (!(data as any)?.success) {
        throw new Error((data as any)?.error || 'Erro ao desconfirmar agendamento');
      }

      toast({
        title: 'Agendamento desconfirmado',
        description: 'O agendamento foi desconfirmado com sucesso',
      });

      refresh();
    } catch (error) {
      logger.error('Error unconfirming appointment', error, 'APPOINTMENTS_SERVER_SIDE');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível desconfirmar o agendamento',
        variant: 'destructive',
      });
    }
  }, [refresh, toast]);

  return {
    // Data
    appointments,
    loading,
    error,
    
    // Pagination
    pagination: {
      currentPage: pagination.page,
      itemsPerPage: pagination.itemsPerPage,
      totalPages,
      totalCount,
      hasNextPage,
      hasPreviousPage,
      startItem,
      endItem,
    },
    
    // Filters
    filters,
    
    // Actions
    fetchAppointments: refresh,
    updateFilters,
    changePage,
    changeItemsPerPage,
    refresh,
    clearFilters,
    cancelAppointment,
    confirmAppointment,
    unconfirmAppointment,
  };
}