import { supabase } from '@/integrations/supabase/client';

export const setupInitialData = async () => {
  try {
    console.log('✅ Setup inicial: Tabelas removidas na limpeza - funcionalidade desabilitada');
    return { success: true, message: 'Setup não necessário após limpeza de tabelas' };
  } catch (error) {
    console.error('Erro ao configurar dados iniciais:', error);
    return { success: false, error };
  }
};

export const validateSystemHealth = async () => {
  const issues = [];

  try {
    // Teste de conectividade com banco
    const { error: dbError } = await supabase
      .from('medicos')
      .select('count')
      .limit(1);

    if (dbError) {
      issues.push('Problema de conectividade com banco de dados');
    }

    // Verificar se há médicos ativos
    const { data: activeDoctors, error: doctorsError } = await supabase
      .from('medicos')
      .select('id')
      .eq('ativo', true);

    if (doctorsError) {
      issues.push('Erro ao verificar médicos ativos');
    } else if (!activeDoctors || activeDoctors.length === 0) {
      issues.push('Nenhum médico ativo encontrado');
    }

    // Verificar agendamentos recentes
    const today = new Date().toISOString().split('T')[0];
    const { data: todayAppointments, error: appointmentsError } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('data_agendamento', today)
      .eq('status', 'agendado');

    if (appointmentsError) {
      issues.push('Erro ao verificar agendamentos');
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats: {
        activeDoctors: activeDoctors?.length || 0,
        todayAppointments: todayAppointments?.length || 0
      }
    };
  } catch (error) {
    return {
      healthy: false,
      issues: ['Erro crítico na verificação do sistema'],
      stats: { activeDoctors: 0, todayAppointments: 0 }
    };
  }
};