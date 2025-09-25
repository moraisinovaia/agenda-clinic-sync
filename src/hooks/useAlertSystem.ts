import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AlertConfig {
  type: 'system' | 'appointment' | 'critical';
  enabled: boolean;
  email: string;
  conditions: {
    systemDown?: boolean;
    appointmentConflicts?: boolean;
    criticalErrors?: boolean;
    databaseIssues?: boolean;
  };
}

interface AlertData {
  to: string;
  subject: string;
  message: string;
  alertType: 'system' | 'appointment' | 'critical';
  data?: any;
}

export const useAlertSystem = () => {
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [lastSystemCheck, setLastSystemCheck] = useState<Date>(new Date());

  useEffect(() => {
    loadAlertConfigs();
  }, []);

  const loadAlertConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_clinica')
        .select('*')
        .eq('categoria', 'alertas')
        .eq('ativo', true);

      if (error) throw error;

      if (data && data.length > 0) {
        const configs = data.map(item => ({
          type: item.chave.replace('alert_', '') as 'system' | 'appointment' | 'critical',
          enabled: item.ativo || false,
          email: item.valor,
          conditions: (typeof item.dados_extras === 'object' && item.dados_extras && !Array.isArray(item.dados_extras)) 
            ? item.dados_extras as AlertConfig['conditions']
            : {}
        }));
        setAlertConfigs(configs);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de alertas:', error);
    }
  };

  const sendAlert = useCallback(async (alertData: AlertData) => {
    try {
      const config = alertConfigs.find(c => c.type === alertData.alertType && c.enabled);
      
      if (!config) {
        console.log(`Alerta ${alertData.alertType} não está habilitado`);
        return false;
      }

      const response = await supabase.functions.invoke('native-alerts', {
        body: {
          ...alertData,
          to: config.email
        }
      });

      if (response.error) {
        console.error('Erro ao enviar alerta:', response.error);
        return false;
      }

      console.log(`Alerta ${alertData.alertType} enviado com sucesso para ${config.email}`);
      return true;
    } catch (error) {
      console.error('Erro no sistema de alertas:', error);
      return false;
    }
  }, [alertConfigs]);

  // Alertas específicos
  const sendSystemDownAlert = useCallback(async (details: any) => {
    const config = alertConfigs.find(c => c.type === 'system' && c.enabled && c.conditions.systemDown);
    if (!config) return false;

    return await sendAlert({
      to: config.email,
      subject: '🚨 Sistema Fora do Ar',
      message: 'O sistema Endogastro está apresentando problemas de conectividade ou está fora do ar.',
      alertType: 'system',
      data: {
        timestamp: new Date().toISOString(),
        systemStatus: 'down',
        details
      }
    });
  }, [alertConfigs, sendAlert]);

  const sendDatabaseIssueAlert = useCallback(async (error: any) => {
    const config = alertConfigs.find(c => c.type === 'system' && c.enabled && c.conditions.databaseIssues);
    if (!config) return false;

    return await sendAlert({
      to: config.email,
      subject: '⚠️ Problema no Banco de Dados',
      message: 'Foi detectado um problema na conexão ou operação do banco de dados.',
      alertType: 'system',
      data: {
        timestamp: new Date().toISOString(),
        error: error.message || error,
        errorCode: error.code || 'UNKNOWN'
      }
    });
  }, [alertConfigs, sendAlert]);

  const sendAppointmentConflictAlert = useCallback(async (conflict: any) => {
    const config = alertConfigs.find(c => c.type === 'appointment' && c.enabled && c.conditions.appointmentConflicts);
    if (!config) return false;

    return await sendAlert({
      to: config.email,
      subject: '⚠️ Conflito de Agendamento',
      message: 'Foi detectado um conflito de agendamento que precisa de atenção.',
      alertType: 'appointment',
      data: {
        timestamp: new Date().toISOString(),
        conflict
      }
    });
  }, [alertConfigs, sendAlert]);

  const sendCriticalErrorAlert = useCallback(async (error: any) => {
    const config = alertConfigs.find(c => c.type === 'critical' && c.enabled && c.conditions.criticalErrors);
    if (!config) return false;

    return await sendAlert({
      to: config.email,
      subject: '🚨 ERRO CRÍTICO',
      message: 'Um erro crítico foi detectado no sistema que requer atenção imediata.',
      alertType: 'critical',
      data: {
        timestamp: new Date().toISOString(),
        error: error.message || error,
        stack: error.stack,
        location: window.location.href
      }
    });
  }, [alertConfigs, sendAlert]);

  // Monitor sistema
  const checkSystemHealth = useCallback(async () => {
    try {
      // Teste de conectividade com banco
      const { error } = await supabase
        .from('medicos')
        .select('id')
        .limit(1);

      if (error) {
        await sendDatabaseIssueAlert(error);
        return false;
      }

      setLastSystemCheck(new Date());
      return true;
    } catch (error) {
      await sendSystemDownAlert({ error });
      return false;
    }
  }, [sendDatabaseIssueAlert, sendSystemDownAlert]);

  // Hook para erros globais
  const handleGlobalError = useCallback(async (error: Error, errorInfo?: any) => {
    // Verificar se é um erro crítico
    const criticalKeywords = ['chunk', 'network', 'timeout', 'critical', 'fatal'];
    const isCritical = criticalKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );

    if (isCritical) {
      await sendCriticalErrorAlert({
        ...error,
        errorInfo
      });
    }
  }, [sendCriticalErrorAlert]);

  return {
    alertConfigs,
    loadAlertConfigs,
    sendAlert,
    sendSystemDownAlert,
    sendDatabaseIssueAlert,
    sendAppointmentConflictAlert,
    sendCriticalErrorAlert,
    checkSystemHealth,
    handleGlobalError,
    lastSystemCheck
  };
};