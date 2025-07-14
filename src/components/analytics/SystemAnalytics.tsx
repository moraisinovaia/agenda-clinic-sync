import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Database, Users, Calendar, TrendingUp } from 'lucide-react';

interface SystemStats {
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  dbSize: string;
  uptime: string;
}

export const SystemAnalytics = () => {
  const [stats, setStats] = useState<SystemStats>({
    totalPatients: 0,
    totalAppointments: 0,
    todayAppointments: 0,
    dbSize: '0 MB',
    uptime: '0 days'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    try {
      setLoading(true);

      // Get patient count
      const { count: patientsCount } = await supabase
        .from('pacientes')
        .select('*', { count: 'exact', head: true });

      // Get total appointments
      const { count: appointmentsCount } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true });

      // Get today's appointments
      const today = new Date().toISOString().split('T')[0];
      const { count: todayCount } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact', head: true })
        .eq('data_agendamento', today);

      setStats({
        totalPatients: patientsCount || 0,
        totalAppointments: appointmentsCount || 0,
        todayAppointments: todayCount || 0,
        dbSize: 'N/A',
        uptime: calculateUptime()
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUptime = () => {
    // Simple uptime calculation based on session storage
    const startTime = sessionStorage.getItem('appStartTime');
    if (!startTime) {
      const now = Date.now();
      sessionStorage.setItem('appStartTime', now.toString());
      return '0 min';
    }

    const elapsed = Date.now() - parseInt(startTime);
    const minutes = Math.floor(elapsed / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}min`;
    }
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Análise do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Análise do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Pacientes</span>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              {stats.totalPatients.toLocaleString()}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Total de Agendamentos</span>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              {stats.totalAppointments.toLocaleString()}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Hoje</span>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              {stats.todayAppointments}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Sessão Ativa</span>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              {stats.uptime}
            </Badge>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          Última atualização: {new Date().toLocaleTimeString('pt-BR')}
        </div>
      </CardContent>
    </Card>
  );
};