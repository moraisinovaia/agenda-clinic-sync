import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppointmentWithRelations } from '@/types/scheduling';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedQuery } from '@/hooks/useOptimizedQuery';
import { usePagination } from '@/hooks/usePagination';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { logger } from '@/utils/logger';
import { useClientTables } from '@/hooks/useClientTables';
import { useStableAuth } from '@/hooks/useStableAuth';

export function useAppointmentsList(itemsPerPage: number = 20) {
  const { toast } = useToast();
  const { measureApiCall } = usePerformanceMetrics();
  const { getTables } = useClientTables();
  const { isSuperAdmin } = useStableAuth();

  // ✅ ESTABILIZAR: Função de query totalmente estável com tratamento robusto
  const fetchAppointments = useCallback(async () => {
    logger.info('Iniciando busca de agendamentos', {}, 'APPOINTMENTS');
    
    return measureApiCall(async () => {
        try {
          // Obter configuração de tabelas de forma robusta
          const tables = await getTables();
          const isIpado = tables.agendamentos === 'ipado_agendamentos';
          
          console.log(`🏥 Buscando agendamentos para cliente ${isIpado ? 'IPADO' : 'INOVAIA'}`);
          console.log('📊 Usando tabelas:', tables);

          // Para super-admin, verificar se há RPC específica, senão usar tabela direta
          let appointmentsWithRelations;
          
          if (isIpado) {
            // Verificar se existe RPC para IPADO
            try {
              const { data, error } = await supabase.rpc('buscar_agendamentos_otimizado_ipado' as any);
              if (!error) {
                appointmentsWithRelations = data;
              } else {
                throw error;
              }
            } catch (rpcError) {
              console.log('⚠️ RPC IPADO não disponível, usando consulta direta');
              // Fallback para consulta direta na tabela IPADO
              const { data, error } = await supabase
                .from(tables.agendamentos)
                .select(`
                  *,
                  pacientes:${tables.pacientes}(nome_completo, convenio, celular, telefone, data_nascimento),
                  medicos:${tables.medicos}(nome, especialidade),
                  atendimentos:${tables.atendimentos}(nome, tipo)
                `)
                .neq('status', 'cancelado')
                .order('data_agendamento', { ascending: false })
                .order('hora_agendamento', { ascending: false });
                
              if (error) throw error;
              appointmentsWithRelations = data;
            }
          } else {
            // INOVAIA - tentar RPC primeiro, depois fallback
            try {
              const { data, error } = await supabase.rpc('buscar_agendamentos_otimizado' as any);
              if (!error) {
                appointmentsWithRelations = data;
              } else {
                throw error;
              }
            } catch (rpcError) {
              console.log('⚠️ RPC INOVAIA não disponível, usando consulta direta');
              // Fallback para consulta direta na tabela INOVAIA
              const { data, error } = await supabase
                .from(tables.agendamentos)
                .select(`
                  *,
                  pacientes:${tables.pacientes}(nome_completo, convenio, celular, telefone, data_nascimento),
                  medicos:${tables.medicos}(nome, especialidade),
                  atendimentos:${tables.atendimentos}(nome, tipo)
                `)
                .neq('status', 'cancelado')
                .order('data_agendamento', { ascending: false })
                .order('hora_agendamento', { ascending: false });
                
              if (error) throw error;
              appointmentsWithRelations = data;
            }
          }

          if (!appointmentsWithRelations) {
            console.log('⚠️ Nenhum agendamento retornado');
            return [];
          }

          // Transformar para o formato esperado (funciona tanto para RPC quanto consulta direta)
          const transformedAppointments = (appointmentsWithRelations || []).map(apt => {
            // Se é resultado de RPC, os campos já vêm formatados
            // Se é resultado de consulta direta, precisa acessar objetos relacionados
            const pacienteData = apt.paciente_nome ? {
              nome_completo: apt.paciente_nome,
              convenio: apt.paciente_convenio,
              celular: apt.paciente_celular,
              telefone: apt.paciente_telefone || '',
              data_nascimento: apt.paciente_data_nascimento || ''
            } : apt.pacientes;
            
            const medicoData = apt.medico_nome ? {
              nome: apt.medico_nome,
              especialidade: apt.medico_especialidade
            } : apt.medicos;
            
            const atendimentoData = apt.atendimento_nome ? {
              nome: apt.atendimento_nome,
              tipo: apt.atendimento_tipo
            } : apt.atendimentos;

            return {
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
              cliente_id: apt.cliente_id || 'default-client-id',
              // Campos adicionais para cancelamento e confirmação
              cancelado_em: apt.cancelado_em || null,
              cancelado_por: apt.cancelado_por || null,
              cancelado_por_user_id: apt.cancelado_por_user_id || null,
              confirmado_em: apt.confirmado_em || null,
              confirmado_por: apt.confirmado_por || null,
              confirmado_por_user_id: apt.confirmado_por_user_id || null,
              convenio: pacienteData?.convenio,
              pacientes: {
                id: apt.paciente_id,
                nome_completo: pacienteData?.nome_completo || '',
                convenio: pacienteData?.convenio || '',
                celular: pacienteData?.celular || '',
                telefone: pacienteData?.telefone || '',
                data_nascimento: pacienteData?.data_nascimento || '',
                created_at: '',
                updated_at: '',
                cliente_id: apt.cliente_id || 'default-client-id'
              },
              medicos: {
                id: apt.medico_id,
                nome: medicoData?.nome || '',
                especialidade: medicoData?.especialidade || '',
                ativo: true,
                crm: '',
                created_at: '',
                updated_at: '',
                convenios_aceitos: [],
                convenios_restricoes: null,
                horarios: null,
                idade_maxima: null,
                idade_minima: null,
                observacoes: '',
                cliente_id: apt.cliente_id || 'default-client-id'
              },
              atendimentos: {
                id: apt.atendimento_id,
                nome: atendimentoData?.nome || '',
                tipo: atendimentoData?.tipo || '',
                ativo: true,
                medico_id: apt.medico_id,
                medico_nome: medicoData?.nome || '',
                created_at: '',
                updated_at: '',
                codigo: '',
                coparticipacao_unimed_20: 0,
                coparticipacao_unimed_40: 0,
                forma_pagamento: 'convenio',
                horarios: null,
                observacoes: '',
                restricoes: null,
                valor_particular: 0,
                cliente_id: apt.cliente_id || 'default-client-id'
              }
            };
          });

          logger.info('Agendamentos carregados com sucesso', { count: transformedAppointments.length }, 'APPOINTMENTS');
          return transformedAppointments;
        } catch (error) {
          logger.error('Erro ao buscar agendamentos', error, 'APPOINTMENTS');
          throw error;
        }
      }, 'fetch_appointments', 'GET');
  }, [measureApiCall, getTables]);

  // Usar cache otimizado para buscar agendamentos
  const { data: appointments, loading, error, refetch, invalidateCache, forceRefetch } = useOptimizedQuery<AppointmentWithRelations[]>(
    fetchAppointments,
    [],
    { 
      cacheKey: 'appointments-list',
      cacheTime: 5 * 60 * 1000, // 5 minutos
      staleTime: 30 * 1000 // 30 segundos
    }
  );

  // Paginação
  const pagination = usePagination(appointments || [], { itemsPerPage });

  // ✅ ESTABILIZAR: Exibir erros sem colocar toast nas dependências  
  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        variant: 'destructive',
      });
    }
  }, [error]); // ✅ REMOVER toast das dependências

  // Buscar agendamentos por médico e data
  const getAppointmentsByDoctorAndDate = (doctorId: string, date: string) => {
    return (appointments || []).filter(
      appointment => 
        appointment.medico_id === doctorId && 
        appointment.data_agendamento === date
    );
  };

  // Cancelar agendamento
  const cancelAppointment = async (appointmentId: string) => {
    try {
      logger.info('Cancelando agendamento', { appointmentId }, 'APPOINTMENTS');

      await measureApiCall(async () => {
        // Buscar perfil do usuário atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        // Usar função de cancelamento com auditoria
        const { data, error } = await supabase.rpc('cancelar_agendamento_soft', {
          p_agendamento_id: appointmentId,
          p_cancelado_por: profile?.nome || 'Usuário',
          p_cancelado_por_user_id: profile?.user_id || null
        });

        if (error) {
          logger.error('Erro ao cancelar agendamento', error, 'APPOINTMENTS');
          throw error;
        }

        if (!(data as any)?.success) {
          const errorMessage = (data as any)?.error || 'Erro ao cancelar agendamento';
          logger.error('Erro no cancelamento', { error: errorMessage }, 'APPOINTMENTS');
          throw new Error(errorMessage);
        }

        return data;
      }, 'cancel_appointment', 'PUT');

      toast({
        title: 'Agendamento cancelado',
        description: 'O agendamento foi cancelado com sucesso',
      });

      // Invalidar cache e recarregar
      refetch();
      logger.info('Agendamento cancelado com sucesso', { appointmentId }, 'APPOINTMENTS');
    } catch (error) {
      logger.error('Erro ao cancelar agendamento', error, 'APPOINTMENTS');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível cancelar o agendamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Confirmar agendamento
  const confirmAppointment = async (appointmentId: string) => {
    try {
      logger.info('Confirmando agendamento', { appointmentId }, 'APPOINTMENTS');

      await measureApiCall(async () => {
        // Buscar perfil do usuário atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        // Usar função de confirmação com auditoria
        const { data, error } = await supabase.rpc('confirmar_agendamento', {
          p_agendamento_id: appointmentId,
          p_confirmado_por: profile?.nome || 'Usuário',
          p_confirmado_por_user_id: profile?.user_id || null
        });

        if (error) {
          logger.error('Erro ao confirmar agendamento', error, 'APPOINTMENTS');
          throw error;
        }

        if (!(data as any)?.success) {
          const errorMessage = (data as any)?.error || 'Erro ao confirmar agendamento';
          logger.error('Erro na confirmação', { error: errorMessage }, 'APPOINTMENTS');
          throw new Error(errorMessage);
        }

        return data;
      }, 'confirm_appointment', 'PUT');

      // ⚡ INVALIDAÇÃO AGRESSIVA DE CACHE APÓS CONFIRMAÇÃO
      console.log('🧹 Iniciando invalidação agressiva de cache após confirmação...');
      
      // 1. Invalidar cache imediatamente
      invalidateCache();
      
      // 2. Aguardar um pouco para garantir que mudança foi persistida no banco
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 3. Forçar refetch completo, ignorando qualquer cache
      await forceRefetch();
      
      console.log('✅ Cache invalidado e dados recarregados após confirmação');

      toast({
        title: 'Agendamento confirmado',
        description: 'O agendamento foi confirmado com sucesso',
      });

      logger.info('Agendamento confirmado com sucesso', { appointmentId }, 'APPOINTMENTS');
    } catch (error) {
      logger.error('Erro ao confirmar agendamento', error, 'APPOINTMENTS');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível confirmar o agendamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Desconfirmar agendamento
  const unconfirmAppointment = async (appointmentId: string) => {
    try {
      logger.info('Desconfirmando agendamento', { appointmentId }, 'APPOINTMENTS');

      const result = await measureApiCall(async () => {
        // Buscar perfil do usuário atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome, user_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        // Usar função de desconfirmação com auditoria
        const { data, error } = await supabase.rpc('desconfirmar_agendamento', {
          p_agendamento_id: appointmentId,
          p_desconfirmado_por: profile?.nome || 'Usuário',
          p_desconfirmado_por_user_id: profile?.user_id || null
        });

        // 🐛 DEBUG: Log da resposta completa para debug
        console.log('🔍 Resposta completa da desconfirmação:', { data, error });

        if (error) {
          logger.error('Erro RPC ao desconfirmar agendamento', error, 'APPOINTMENTS');
          throw error;
        }

        // ✅ CORREÇÃO: Melhorar validação da resposta
        const response = data as { success?: boolean; error?: string; message?: string };
        
        if (!response || response.success === false) {
          const errorMessage = response?.error || response?.message || 'Erro ao desconfirmar agendamento';
          logger.error('Erro na validação da desconfirmação', { response, errorMessage }, 'APPOINTMENTS');
          throw new Error(errorMessage);
        }

        return data;
      }, 'unconfirm_appointment', 'PUT');

      // ⚡ INVALIDAÇÃO AGRESSIVA DE CACHE APÓS DESCONFIRMAÇÃO
      console.log('🧹 Iniciando invalidação agressiva de cache após desconfirmação...');
      
      // 1. Invalidar cache imediatamente
      invalidateCache();
      
      // 2. Aguardar um pouco para garantir que mudança foi persistida no banco
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 3. Forçar refetch completo, ignorando qualquer cache
      await forceRefetch();
      
      console.log('✅ Cache invalidado e dados recarregados após desconfirmação');

      toast({
        title: 'Agendamento desconfirmado',
        description: 'O agendamento foi desconfirmado com sucesso',
      });

      logger.info('Agendamento desconfirmado com sucesso', { appointmentId }, 'APPOINTMENTS');
    } catch (error) {
      logger.error('Erro ao desconfirmar agendamento', error, 'APPOINTMENTS');
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível desconfirmar o agendamento',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    appointments: appointments || [],
    loading,
    getAppointmentsByDoctorAndDate,
    cancelAppointment,
    confirmAppointment,
    unconfirmAppointment,
    refetch,
    invalidateCache,
    forceRefetch,
    pagination,
    error
  };
}