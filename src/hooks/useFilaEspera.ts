import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStableAuth } from '@/hooks/useStableAuth';
import { FilaEsperaWithRelations, FilaEsperaFormData, FilaStatus } from '@/types/fila-espera';

export const useFilaEspera = () => {
  const { clinicAdminClienteId, isClinicAdmin } = useStableAuth();
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

      // Resolver cliente_id: admin_clinica usa o próprio; senão tenta via medico
      let clienteId = clinicAdminClienteId;
      if (!clienteId) {
        const { data: medico } = await supabase
          .from('medicos')
          .select('cliente_id')
          .eq('id', formData.medicoId)
          .single();
        clienteId = medico?.cliente_id ?? null;
      }
      if (!clienteId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível identificar a clínica.',
          variant: 'destructive',
        });
        return false;
      }

      const { data, error } = await supabase.rpc('entrar_fila_espera_atomico', {
        p_cliente_id: clienteId,
        p_paciente_id: formData.pacienteId,
        p_medico_id: formData.medicoId,
        p_atendimento_id: formData.atendimentoId,
        p_data_preferida: formData.dataPreferida,
        p_periodo_preferido: formData.periodoPreferido,
        p_data_limite: formData.dataLimite,
        p_observacoes: formData.observacoes ?? null,
      });

      const result = data as { success?: boolean; error?: string } | null;
      if (error || (result && result.success === false)) {
        const msg = result?.error || error?.message || 'Não foi possível adicionar à fila de espera.';
        console.error('Erro ao adicionar à fila:', msg);
        toast({ title: 'Erro', description: msg, variant: 'destructive' });
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