import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemSettings {
  sessionTimeout: number;
  enableNotifications: boolean;
  autoBackup: boolean;
  backupInterval: number;
  maxAppointmentsPerDay: number;
  reminderTime: number;
  autoBackupMaxCount: number;
  autoBackupIncludeData: boolean;
  autoBackupIncludeSchema: boolean;
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    sessionTimeout: 8,
    enableNotifications: true,
    autoBackup: true,
    backupInterval: 24,
    maxAppointmentsPerDay: 20,
    reminderTime: 24,
    autoBackupMaxCount: 7,
    autoBackupIncludeData: true,
    autoBackupIncludeSchema: true,
  });
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Buscar cliente_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('Usuário não autenticado');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.cliente_id) {
        console.error('Cliente não encontrado para o usuário');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('configuracoes_clinica')
        .select('chave, valor')
        .eq('cliente_id', profile.cliente_id)
        .in('chave', [
          'session_timeout',
          'enable_notifications', 
          'auto_backup_enabled',
          'auto_backup_interval',
          'max_appointments_per_day',
          'reminder_time',
          'auto_backup_max_count',
          'auto_backup_include_data',
          'auto_backup_include_schema'
        ]);

      if (error) throw error;

      if (data) {
        const newSettings = { ...settings };
        data.forEach(setting => {
          const key = setting.chave;
          let value: any = setting.valor;
          
          // Converter tipos baseado no valor
          if (value === 'true' || value === 'false') {
            value = value === 'true';
          } else if (!isNaN(Number(value))) {
            value = parseInt(value);
          }

          // Mapear chaves do banco para o estado
          switch (key) {
            case 'session_timeout':
              newSettings.sessionTimeout = value as number;
              break;
            case 'enable_notifications':
              newSettings.enableNotifications = value as boolean;
              break;
            case 'auto_backup_enabled':
              newSettings.autoBackup = value as boolean;
              break;
            case 'auto_backup_interval':
              newSettings.backupInterval = value as number;
              break;
            case 'max_appointments_per_day':
              newSettings.maxAppointmentsPerDay = value as number;
              break;
            case 'reminder_time':
              newSettings.reminderTime = value as number;
              break;
            case 'auto_backup_max_count':
              newSettings.autoBackupMaxCount = value as number;
              break;
            case 'auto_backup_include_data':
              newSettings.autoBackupIncludeData = value as boolean;
              break;
            case 'auto_backup_include_schema':
              newSettings.autoBackupIncludeSchema = value as boolean;
              break;
          }
        });
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações do sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // Buscar cliente_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('cliente_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.cliente_id) {
        throw new Error('Cliente não encontrado para o usuário');
      }
      
      const updates = [
        { chave: 'session_timeout', valor: settings.sessionTimeout.toString() },
        { chave: 'enable_notifications', valor: settings.enableNotifications.toString() },
        { chave: 'auto_backup_enabled', valor: settings.autoBackup.toString() },
        { chave: 'auto_backup_interval', valor: settings.backupInterval.toString() },
        { chave: 'max_appointments_per_day', valor: settings.maxAppointmentsPerDay.toString() },
        { chave: 'reminder_time', valor: settings.reminderTime.toString() },
        { chave: 'auto_backup_max_count', valor: settings.autoBackupMaxCount.toString() },
        { chave: 'auto_backup_include_data', valor: settings.autoBackupIncludeData.toString() },
        { chave: 'auto_backup_include_schema', valor: settings.autoBackupIncludeSchema.toString() },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('configuracoes_clinica')
          .upsert({ 
            chave: update.chave, 
            valor: update.valor,
            categoria: getCategoryForKey(update.chave),
            cliente_id: profile.cliente_id,
            ativo: true
          }, { 
            onConflict: 'chave,cliente_id' 
          });

        if (error) throw error;
      }

      setHasChanges(false);
      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryForKey = (key: string): string => {
    if (key.startsWith('auto_backup')) return 'backup';
    if (key.includes('notification')) return 'notifications';
    if (key === 'session_timeout') return 'session';
    if (key === 'max_appointments_per_day') return 'performance';
    return 'general';
  };

  const updateSetting = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetSettings = () => {
    setSettings({
      sessionTimeout: 8,
      enableNotifications: true,
      autoBackup: true,
      backupInterval: 24,
      maxAppointmentsPerDay: 20,
      reminderTime: 24,
      autoBackupMaxCount: 7,
      autoBackupIncludeData: true,
      autoBackupIncludeSchema: true,
    });
    setHasChanges(true);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    loading,
    hasChanges,
    updateSetting,
    saveSettings,
    resetSettings,
    loadSettings
  };
};