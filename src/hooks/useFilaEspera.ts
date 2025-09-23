import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FilaEsperaWithRelations, FilaEsperaFormData, FilaStatus } from '@/types/fila-espera';

export const useFilaEspera = () => {
  const [filaEspera, setFilaEspera] = useState<FilaEsperaWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const fetchFilaEspera = async (showToastOnError = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('fila_espera')
        .select(`
          *,
          pacientes(*),
          medicos(*),
          atendimentos(*),
          agendamentos(*)
        `)
        .order('prioridade', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar fila de espera:', error);
        setError(error.message);
        
        // Só mostrar toast se explicitamente solicitado
        if (showToastOnError && retryCount === 0) {
          toast({
            title: "Erro",
            description: "Não foi possível carregar a fila de espera.",
            variant: "destructive",
          });
        }
        
        // Tentar novamente automaticamente em caso de erro de permissão
        if (error.message.includes('permission') && retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setTimeout(() => fetchFilaEspera(false), 1000 * (retryCount + 1));
        }
        return;
      }

      setFilaEspera(data || []);
      setRetryCount(0);
    } catch (error) {
      console.error('Erro inesperado:', error);
      setError('Erro inesperado ao carregar dados');
      
      if (showToastOnError) {
        toast({
          title: "Erro",
          description: "Erro inesperado ao carregar dados.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const adicionarFilaEspera = async (formData: FilaEsperaFormData) => {
    try {
      setLoading(true);
      
      // Primeiro, obter o cliente_id do usuário atual
      const { data: clienteId, error: clienteError } = await supabase.rpc('get_user_cliente_id');
      
      if (clienteError || !clienteId) {
        setError('Erro de autenticação: não foi possível identificar o cliente');
        return;
      }

      const { error } = await supabase
        .from('fila_espera')
        .insert({
          paciente_id: formData.pacienteId,
          medico_id: formData.medicoId,
          atendimento_id: formData.atendimentoId,
          data_preferida: formData.dataPreferida,
          periodo_preferido: formData.periodoPreferido,
          observacoes: formData.observacoes,
          prioridade: formData.prioridade,
          data_limite: formData.dataLimite,
          status: 'aguardando',
          cliente_id: clienteId,
        });

      if (error) {
        console.error('Erro ao adicionar à fila:', error);
        toast({
          title: "Erro",
          description: "Não foi possível adicionar à fila de espera.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: "Paciente adicionado à fila de espera com sucesso!",
      });

      await fetchFilaEspera();
      return true;
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao adicionar à fila.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const atualizarStatusFila = async (id: string, status: string, agendamentoId?: string) => {
    try {
      const updateData: any = { status };
      if (agendamentoId) {
        updateData.agendamento_id = agendamentoId;
      }

      const { error } = await supabase
        .from('fila_espera')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o status.",
          variant: "destructive",
        });
        return false;
      }

      await fetchFilaEspera();
      return true;
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao atualizar status.",
        variant: "destructive",
      });
      return false;
    }
  };

  const removerDaFila = async (id: string) => {
    try {
      const { error } = await supabase
        .from('fila_espera')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao remover da fila:', error);
        toast({
          title: "Erro",
          description: "Não foi possível remover da fila.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: "Paciente removido da fila de espera.",
      });

      await fetchFilaEspera();
      return true;
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao remover da fila.",
        variant: "destructive",
      });
      return false;
    }
  };

  const getFilaStatus = (): FilaStatus => {
    const total = filaEspera.length;
    const aguardando = filaEspera.filter(f => f.status === 'aguardando').length;
    const notificado = filaEspera.filter(f => f.status === 'notificado').length;
    const agendado = filaEspera.filter(f => f.status === 'agendado').length;
    const cancelado = filaEspera.filter(f => f.status === 'cancelado').length;

    return { total, aguardando, notificado, agendado, cancelado };
  };

  const getFilaPorMedico = (medicoId: string) => {
    return filaEspera.filter(f => f.medico_id === medicoId && f.status === 'aguardando');
  };

  // Carregar dados automaticamente quando o hook é usado
  useEffect(() => {
    fetchFilaEspera();
  }, []);

  return {
    filaEspera,
    loading,
    error,
    fetchFilaEspera,
    adicionarFilaEspera,
    atualizarStatusFila,
    removerDaFila,
    getFilaStatus,
    getFilaPorMedico,
  };
};