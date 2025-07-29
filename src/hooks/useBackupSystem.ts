import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BackupStatus {
  lastBackup?: string;
  cronJobActive?: boolean;
  totalBackups?: number;
}

export const useBackupSystem = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BackupStatus>({});
  const { toast } = useToast();

  const getBackupStatus = async () => {
    try {
      // Buscar último backup
      const { data: lastBackupData } = await supabase
        .from('system_backups')
        .select('created_at, backup_type')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Buscar total de backups
      const { count: totalBackups } = await supabase
        .from('system_backups')
        .select('*', { count: 'exact', head: true });

      // Buscar status do cron job
      const { data: cronStatus } = await supabase
        .rpc('get_backup_cron_status')
        .single();

      setStatus({
        lastBackup: lastBackupData?.created_at,
        cronJobActive: cronStatus?.active || false,
        totalBackups: totalBackups || 0
      });

    } catch (error) {
      console.error('Erro ao buscar status do backup:', error);
    }
  };

  const testManualBackup = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('backup-system/create', {
        body: {
          includeData: true,
          includeSchema: true,
          tables: ['agendamentos', 'pacientes', 'medicos', 'atendimentos'],
          compressionLevel: 1
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Backup manual criado com sucesso",
      });

      // Atualizar status
      await getBackupStatus();

    } catch (error) {
      console.error('Erro no backup manual:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar backup manual",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testAutoBackup = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('auto-backup', {
        body: { test: true }
      });

      if (error) throw error;

      toast({
        title: "Sucesso", 
        description: "Teste de backup automático executado",
      });

      await getBackupStatus();

    } catch (error) {
      console.error('Erro no teste de backup automático:', error);
      toast({
        title: "Erro",
        description: "Erro no teste de backup automático",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCronJob = async (enable: boolean) => {
    try {
      setLoading(true);

      const { error } = await supabase.rpc('toggle_backup_cron', {
        enable_cron: enable
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Backup automático ${enable ? 'habilitado' : 'desabilitado'}`,
      });

      await getBackupStatus();

    } catch (error) {
      console.error('Erro ao alterar cron job:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar configuração de backup automático",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    status,
    getBackupStatus,
    testManualBackup,
    testAutoBackup,
    toggleCronJob
  };
};