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
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value, type')
        .in('key', [
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
          const key = setting.key;
          let value: any = setting.value;
          
          // Converter tipos
          if (setting.type === 'boolean') {
            value = value === 'true';
          } else if (setting.type === 'number') {
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
      
      const updates = [
        { key: 'session_timeout', value: settings.sessionTimeout.toString(), type: 'number' },
        { key: 'enable_notifications', value: settings.enableNotifications.toString(), type: 'boolean' },
        { key: 'auto_backup_enabled', value: settings.autoBackup.toString(), type: 'boolean' },
        { key: 'auto_backup_interval', value: settings.backupInterval.toString(), type: 'number' },
        { key: 'max_appointments_per_day', value: settings.maxAppointmentsPerDay.toString(), type: 'number' },
        { key: 'reminder_time', value: settings.reminderTime.toString(), type: 'number' },
        { key: 'auto_backup_max_count', value: settings.autoBackupMaxCount.toString(), type: 'number' },
        { key: 'auto_backup_include_data', value: settings.autoBackupIncludeData.toString(), type: 'boolean' },
        { key: 'auto_backup_include_schema', value: settings.autoBackupIncludeSchema.toString(), type: 'boolean' },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({ 
            key: update.key, 
            value: update.value,
            type: update.type,
            category: getCategoryForKey(update.key)
          }, { 
            onConflict: 'key' 
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