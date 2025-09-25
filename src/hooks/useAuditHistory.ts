import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AuditHistoryEntry {
  id: string;
  audit_timestamp: string;
  action: string;
  user_name: string | null;
  changed_fields: string[] | null;
  old_values: any;
  new_values: any;
  profile_name: string | null;
}

export const useAuditHistory = () => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AuditHistoryEntry[]>([]);
  const { toast } = useToast();

  const fetchAuditHistory = async (agendamentoId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_agendamento_audit_history', {
        p_agendamento_id: agendamentoId
      });

      if (error) {
        console.error('Erro ao buscar histórico de auditoria:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o histórico de alterações",
          variant: "destructive",
        });
        return;
      }

      setHistory(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao carregar histórico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFieldDisplayName = (fieldName: string): string => {
    const fieldMap: Record<string, string> = {
      'data_agendamento': 'Data do agendamento',
      'hora_agendamento': 'Hora do agendamento',
      'status': 'Status',
      'observacoes': 'Observações',
      'medico_id': 'Médico',
      'atendimento_id': 'Atendimento',
      'paciente_id': 'Paciente'
    };
    return fieldMap[fieldName] || fieldName;
  };

  const getActionDisplayName = (action: string): string => {
    const actionMap: Record<string, string> = {
      'INSERT': 'Criado',
      'UPDATE': 'Alterado',
      'DELETE': 'Excluído'
    };
    return actionMap[action] || action;
  };

  const formatValue = (value: any, fieldName: string): string => {
    if (value === null || value === undefined) return '(vazio)';
    
    if (fieldName === 'status') {
      const statusMap: Record<string, string> = {
        'agendado': 'Agendado',
        'confirmado': 'Confirmado',
        'cancelado': 'Cancelado'
      };
      return statusMap[value] || value;
    }
    
    if (fieldName === 'data_agendamento') {
      return new Date(value).toLocaleDateString('pt-BR');
    }
    
    if (fieldName === 'hora_agendamento') {
      return value;
    }
    
    return String(value);
  };

  return {
    loading,
    history,
    fetchAuditHistory,
    getFieldDisplayName,
    getActionDisplayName,
    formatValue
  };
};