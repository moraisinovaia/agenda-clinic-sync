// Edição inline de observação de agendamento.
//
// Usa RPC dedicada (atualizar_observacao_agendamento) com optimistic lock
// via updated_at. NÃO usa criar_agendamento_atomico (overkill — sem
// validação de limite/conflito, é só texto livre).
//
// Erros tratados:
//   - 40001 → outro user editou (frontend pede recarregar)
//   - 42501 → sem permissão (médico, cliente errado)
//   - 22023 → status terminal
//   - 22001 → texto muito longo (>1000)
//   - rede → retry pelo tanstack mutation

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UpdateObservacaoInput {
  agendamentoId: string;
  observacao: string;
  expectedUpdatedAt: string;
}

interface UpdateObservacaoResult {
  success: boolean;
  changed: boolean;
  observacoes: string | null;
  updated_at: string;
}

interface UpdateObservacaoError extends Error {
  code?: string;
  isConflict?: boolean;
  isPermission?: boolean;
  isTerminalStatus?: boolean;
}

function classifyError(err: any): UpdateObservacaoError {
  const code = err?.code || '';
  const message = err?.message || 'Erro ao atualizar observação';
  const e: UpdateObservacaoError = new Error(message);
  e.code = code;
  if (code === '40001' || message.includes('modificado por outro usuário')) {
    e.isConflict = true;
  } else if (code === '42501') {
    e.isPermission = true;
  } else if (code === '22023') {
    e.isTerminalStatus = true;
  }
  return e;
}

export function useUpdateObservacao() {
  const queryClient = useQueryClient();

  return useMutation<UpdateObservacaoResult, UpdateObservacaoError, UpdateObservacaoInput>({
    mutationFn: async ({ agendamentoId, observacao, expectedUpdatedAt }) => {
      const { data, error } = await supabase.rpc(
        'atualizar_observacao_agendamento' as any,
        {
          p_agendamento_id: agendamentoId,
          p_observacao: observacao,
          p_expected_updated_at: expectedUpdatedAt,
        }
      );
      if (error) throw classifyError(error);
      return data as UpdateObservacaoResult;
    },
    onSuccess: (data) => {
      if (data.changed) {
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
        queryClient.invalidateQueries({ queryKey: ['doctor-schedule'] });
        toast({
          title: 'Observação atualizada',
          description: 'A alteração foi registrada com sucesso.',
        });
      }
    },
    onError: (err) => {
      if (err.isConflict) {
        toast({
          title: 'Conflito de edição',
          description: 'Outro usuário alterou este agendamento. Recarregue a página.',
          variant: 'destructive',
        });
      } else if (err.isPermission) {
        toast({
          title: 'Sem permissão',
          description: 'Apenas recepção e administrador podem editar observação.',
          variant: 'destructive',
        });
      } else if (err.isTerminalStatus) {
        toast({
          title: 'Agendamento bloqueado',
          description: 'Não é possível editar observação de agendamento cancelado/excluído.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao atualizar',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    retry: (failureCount, err) => {
      // Não retentar conflito/permissão/status; só erros de rede (max 2 tentativas)
      if (err.isConflict || err.isPermission || err.isTerminalStatus) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });
}
