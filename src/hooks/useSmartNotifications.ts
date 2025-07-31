import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationStats {
  total_sent: number;
  success_rate: number;
  last_24h: number;
  pending: number;
}

interface NotificationTemplate {
  id: string;
  type: string;
  name: string;
  subject: string;
  message: string;
  variables: string[];
  active: boolean;
}

interface ScheduledNotification {
  id: string;
  agendamento_id: string;
  type: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed';
  patient_name?: string;
  doctor_name?: string;
}

export const useSmartNotifications = () => {
  const [stats, setStats] = useState<NotificationStats>({
    total_sent: 0,
    success_rate: 0,
    last_24h: 0,
    pending: 0
  });
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Carregar estatísticas
      await loadStats();
      
      // Carregar templates (mock por enquanto)
      loadTemplates();
      
      // Carregar notificações agendadas
      await loadScheduledNotifications();
      
    } catch (error) {
      console.error('Erro ao carregar dados de notificações:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados das notificações',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Carregar estatísticas do sistema
  const loadStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('notification-scheduler', {
        body: { action: 'analytics' }
      });

      if (error) throw error;

      const analytics = data.analytics;
      
      // Calcular estatísticas para últimas 24h
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last24hCount = Object.entries(analytics.daily_stats || {})
        .filter(([date]) => new Date(date) >= last24h)
        .reduce((sum, [, count]) => sum + (count as number), 0);

      setStats({
        total_sent: analytics.total_sent || 0,
        success_rate: analytics.success_rate || 0,
        last_24h: last24hCount,
        pending: 0 // Será implementado depois
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Carregar templates (mock)
  const loadTemplates = () => {
    const mockTemplates: NotificationTemplate[] = [
      {
        id: '1',
        type: '48h',
        name: 'Lembrete 48h',
        subject: 'Sua consulta em 48h',
        message: 'Olá {paciente_nome}! Sua consulta está marcada para {data_consulta} às {hora_consulta}...',
        variables: ['paciente_nome', 'data_consulta', 'hora_consulta', 'medico_nome'],
        active: true
      },
      {
        id: '2',
        type: '24h',
        name: 'Confirmação 24h',
        subject: 'Confirme sua presença',
        message: 'Sua consulta é amanhã! Por favor, confirme sua presença...',
        variables: ['paciente_nome', 'data_consulta', 'hora_consulta'],
        active: true
      },
      {
        id: '3',
        type: '2h',
        name: 'Lembrete 2h',
        subject: 'Sua consulta é em 2 horas',
        message: 'Sua consulta é hoje às {hora_consulta}. Não se esqueça!',
        variables: ['paciente_nome', 'hora_consulta', 'endereco'],
        active: true
      },
      {
        id: '4',
        type: 'followup',
        name: 'Follow-up',
        subject: 'Como foi sua consulta?',
        message: 'Esperamos que sua consulta tenha sido proveitosa. Avalie nossa clínica...',
        variables: ['paciente_nome', 'medico_nome'],
        active: false
      }
    ];
    setTemplates(mockTemplates);
  };

  // Carregar notificações agendadas
  const loadScheduledNotifications = async () => {
    try {
      // Por enquanto usando mock, mas será implementado com Supabase
      const mockScheduled: ScheduledNotification[] = [
        {
          id: '1',
          agendamento_id: 'apt-1',
          type: '24h',
          scheduled_for: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          patient_name: 'João Silva',
          doctor_name: 'Dr. Maria Santos'
        },
        {
          id: '2',
          agendamento_id: 'apt-2',
          type: '2h',
          scheduled_for: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          patient_name: 'Ana Costa',
          doctor_name: 'Dr. Pedro Lima'
        }
      ];
      setScheduledNotifications(mockScheduled);
    } catch (error) {
      console.error('Erro ao carregar notificações agendadas:', error);
    }
  };

  // Processar notificações pendentes
  const processNotifications = useCallback(async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('notification-scheduler', {
        body: { action: 'process' }
      });

      if (error) throw error;

      toast({
        title: 'Processamento concluído',
        description: `${data.sent} notificações enviadas com sucesso`,
      });

      // Recarregar dados
      await loadData();
      
      return {
        success: true,
        sent: data.sent,
        errors: data.errors
      };
    } catch (error) {
      console.error('Erro ao processar notificações:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao processar notificações',
        variant: 'destructive'
      });
      return {
        success: false,
        sent: 0,
        errors: 1
      };
    } finally {
      setIsProcessing(false);
    }
  }, [toast, loadData]);

  // Agendar notificação específica
  const scheduleNotification = useCallback(async (
    agendamentoId: string, 
    type: string, 
    scheduledFor: Date
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('notification-scheduler', {
        body: { 
          action: 'schedule',
          agendamento_id: agendamentoId,
          type,
          scheduled_for: scheduledFor.toISOString()
        }
      });

      if (error) throw error;

      toast({
        title: 'Notificação agendada',
        description: 'A notificação foi agendada com sucesso',
      });

      await loadScheduledNotifications();
      return true;
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao agendar notificação',
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  // Cancelar notificação agendada
  const cancelScheduledNotification = useCallback(async (notificationId: string) => {
    try {
      // Implementar cancelamento via Supabase
      setScheduledNotifications(prev => 
        prev.filter(notif => notif.id !== notificationId)
      );

      toast({
        title: 'Notificação cancelada',
        description: 'A notificação agendada foi cancelada',
      });

      return true;
    } catch (error) {
      console.error('Erro ao cancelar notificação:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao cancelar notificação',
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  // Atualizar template
  const updateTemplate = useCallback(async (
    templateId: string, 
    updates: Partial<NotificationTemplate>
  ) => {
    try {
      setTemplates(prev => 
        prev.map(template => 
          template.id === templateId 
            ? { ...template, ...updates }
            : template
        )
      );

      toast({
        title: 'Template atualizado',
        description: 'O template foi atualizado com sucesso',
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar template:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar template',
        variant: 'destructive'
      });
      return false;
    }
  }, [toast]);

  // Obter notificações por paciente
  const getPatientNotifications = useCallback(async (patientId: string) => {
    try {
      // Implementar busca por notificações do paciente
      return [];
    } catch (error) {
      console.error('Erro ao buscar notificações do paciente:', error);
      return [];
    }
  }, []);

  // Estatísticas em tempo real
  const getRealtimeStats = useCallback(() => {
    return {
      ...stats,
      efficiency: stats.total_sent > 0 ? (stats.success_rate / 100) : 0,
      avg_per_day: stats.total_sent / 30,
      next_notifications: scheduledNotifications.filter(n => n.status === 'pending').length
    };
  }, [stats, scheduledNotifications]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    // Estado
    stats,
    templates,
    scheduledNotifications,
    isLoading,
    isProcessing,
    
    // Ações
    processNotifications,
    scheduleNotification,
    cancelScheduledNotification,
    updateTemplate,
    getPatientNotifications,
    
    // Utilitários
    reloadData: loadData,
    getRealtimeStats
  };
};