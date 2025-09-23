import { supabase } from '@/integrations/supabase/client';

export const setupInitialData = async () => {
  try {
    // Verificar se já existem configurações de alertas
    const { data: alertConfigs, error: alertError } = await supabase
      .from('configuracoes_clinica')
      .select('*')
      .eq('categoria', 'alertas');

    // Se houver erro na consulta, não tenta inserir dados
    if (alertError) {
      console.warn('Erro ao verificar configurações existentes:', alertError);
      return { success: false, error: alertError };
    }

    if (!alertConfigs || alertConfigs.length === 0) {
      // Inserir configurações padrão de alertas
      const defaultAlertConfigs = [
        {
          categoria: 'alertas',
          chave: 'alert_system',
          valor: 'moraisinovaia@gmail.com',
          ativo: true,
          dados_extras: {
            systemDown: true,
            databaseIssues: true
          }
        },
        {
          categoria: 'alertas',
          chave: 'alert_appointment',
          valor: 'moraisinovaia@gmail.com',
          ativo: true,
          dados_extras: {
            appointmentConflicts: true
          }
        },
        {
          categoria: 'alertas',
          chave: 'alert_critical',
          valor: 'moraisinovaia@gmail.com',
          ativo: true,
          dados_extras: {
            criticalErrors: true
          }
        }
      ];

      const { error } = await supabase
        .from('configuracoes_clinica')
        .insert(defaultAlertConfigs);

      if (error) {
        console.error('Erro ao inserir configurações padrão:', error);
      } else {
        console.log('✅ Configurações de alertas criadas com sucesso');
      }
    }

    // Verificar configurações de sistema
    const { data: systemConfigs, error: systemError } = await supabase
      .from('configuracoes_clinica')
      .select('*')
      .eq('categoria', 'sistema');

    // Se houver erro na consulta, não tenta inserir dados
    if (systemError) {
      console.warn('Erro ao verificar configurações de sistema:', systemError);
      return { success: false, error: systemError };
    }

    if (!systemConfigs || systemConfigs.length === 0) {
      const defaultSystemConfigs = [
        {
          categoria: 'sistema',
          chave: 'clinic_name',
          valor: 'INOVAIA',
          ativo: true
        },
        {
          categoria: 'sistema',
          chave: 'notification_email',
          valor: 'moraisinovaia@gmail.com',
          ativo: true
        },
        {
          categoria: 'sistema',
          chave: 'max_appointments_per_day',
          valor: '50',
          ativo: true
        }
      ];

      await supabase
        .from('configuracoes_clinica')
        .insert(defaultSystemConfigs);

      console.log('✅ Configurações de sistema criadas com sucesso');
    }

    return { success: true };
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