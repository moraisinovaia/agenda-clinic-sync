import { supabase } from '@/integrations/supabase/client';

export const setupInitialData = async () => {
  try {
    console.log('🚀 Sistema já configurado e otimizado para produção');
    
    // Verificar saúde do sistema
    const healthCheck = await validateSystemHealth();
    
    if (!healthCheck.healthy) {
      console.warn('⚠️ Problemas detectados no sistema:', healthCheck.issues);
      return { 
        success: false, 
        error: 'Sistema com problemas de saúde',
        issues: healthCheck.issues 
      };
    }

    console.log('✅ Sistema saudável e pronto para produção');
    console.log('📊 Stats:', healthCheck.stats);
    
    return { 
      success: true,
      message: 'Sistema configurado e validado para produção',
      stats: healthCheck.stats
    };
  } catch (error) {
    console.error('❌ Erro ao validar sistema:', error);
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