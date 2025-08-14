import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StatsMetrics {
  totalDoctors: number;
  activeDoctors: number;
  todayAppointments: number;
  tomorrowAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  activeDoctorsToday: number;
  occupationRate: number;
  lastUpdated: Date;
}

export const useStatsMetrics = () => {
  const [metrics, setMetrics] = useState<StatsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Buscar dados dos médicos
      const { data: doctors, error: doctorsError } = await supabase
        .from('medicos')
        .select('id, ativo');

      if (doctorsError) throw doctorsError;

      // Buscar contagens de agendamentos por status
      const { data: statusCounts, error: statusError } = await supabase
        .from('agendamentos')
        .select('status, data_agendamento, medico_id')
        .neq('status', 'cancelado_bloqueio');

      if (statusError) throw statusError;

      // Calcular métricas
      const totalDoctors = doctors?.length || 0;
      const activeDoctors = doctors?.filter(d => d.ativo)?.length || 0;
      
      const todayAppointments = statusCounts?.filter(apt => 
        apt.data_agendamento === today && apt.status !== 'cancelado'
      )?.length || 0;
      
      const tomorrowAppointments = statusCounts?.filter(apt => 
        apt.data_agendamento === tomorrow && apt.status !== 'cancelado'
      )?.length || 0;
      
      const pendingAppointments = statusCounts?.filter(apt => 
        apt.status === 'agendado'
      )?.length || 0;
      
      const confirmedAppointments = statusCounts?.filter(apt => 
        apt.status === 'confirmado'
      )?.length || 0;
      
      const cancelledAppointments = statusCounts?.filter(apt => 
        apt.status === 'cancelado'
      )?.length || 0;

      // Médicos ativos hoje
      const activeDoctorsToday = new Set(
        statusCounts
          ?.filter(apt => apt.data_agendamento === today && apt.status !== 'cancelado')
          ?.map(apt => apt.medico_id)
      ).size;

      // Taxa de ocupação
      const occupationRate = activeDoctors > 0 ? Math.round((activeDoctorsToday / activeDoctors) * 100) : 0;

      setMetrics({
        totalDoctors,
        activeDoctors,
        todayAppointments,
        tomorrowAppointments,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        activeDoctorsToday,
        occupationRate,
        lastUpdated: new Date()
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar métricas';
      setError(errorMessage);
      toast({
        title: "Erro ao carregar métricas",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Auto-refresh a cada 5 minutos
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics
  };
};