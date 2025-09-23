import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStableAuth } from './useStableAuth';
import { toast } from 'sonner';

interface ClientUsageMetrics {
  id: string;
  cliente_id: string;
  metric_date: string;
  total_agendamentos: number;
  agendamentos_criados: number;  
  agendamentos_cancelados: number;
  agendamentos_confirmados: number;
  usuarios_ativos: number;
  pacientes_cadastrados: number;
  created_at: string;
  updated_at: string;
}

export const useClientMetrics = () => {
  const [metrics, setMetrics] = useState<ClientUsageMetrics[]>([]);
  const [todayMetrics, setTodayMetrics] = useState<ClientUsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useStableAuth();

  const fetchMetrics = async (days: number = 30) => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('client_usage_metrics')
        .select('*')
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .order('metric_date', { ascending: false });

      if (error) throw error;
      
      const metricsData = data || [];
      setMetrics(metricsData);
      
      // Find today's metrics
      const today = new Date().toISOString().split('T')[0];
      const todayData = metricsData.find(m => m.metric_date === today);
      setTodayMetrics(todayData || null);
      
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      toast.error('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  const updateMetrics = async () => {
    try {
      const { error } = await supabase.rpc('update_client_metrics');
      if (error) throw error;
      
      await fetchMetrics();
      toast.success('Métricas atualizadas');
    } catch (error) {
      console.error('Erro ao atualizar métricas:', error);
      toast.error('Erro ao atualizar métricas');
    }
  };

  const getWeeklyMetrics = () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const weekStartDate = lastWeek.toISOString().split('T')[0];
    
    return metrics.filter(m => m.metric_date >= weekStartDate);
  };

  const getMonthlyMetrics = () => {
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const monthStartDate = lastMonth.toISOString().split('T')[0];
    
    return metrics.filter(m => m.metric_date >= monthStartDate);
  };

  useEffect(() => {
    fetchMetrics();
  }, [isAuthenticated]);

  return {
    metrics,
    todayMetrics,
    loading,
    updateMetrics,
    getWeeklyMetrics,
    getMonthlyMetrics,
    refetch: fetchMetrics
  };
};