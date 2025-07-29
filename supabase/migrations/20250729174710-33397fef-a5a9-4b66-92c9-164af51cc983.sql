-- Criar tabela para configurações do sistema
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category VARCHAR DEFAULT 'general',
  description TEXT,
  type VARCHAR DEFAULT 'string',
  editable BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir configurações padrão de backup
INSERT INTO public.system_settings (key, value, category, description, type) VALUES
('auto_backup_enabled', 'true', 'backup', 'Habilitar backups automáticos', 'boolean'),
('auto_backup_interval', '24', 'backup', 'Intervalo entre backups em horas', 'number'),
('auto_backup_max_count', '7', 'backup', 'Número máximo de backups a manter', 'number'),
('auto_backup_include_data', 'true', 'backup', 'Incluir dados nos backups', 'boolean'),
('auto_backup_include_schema', 'true', 'backup', 'Incluir schema nos backups', 'boolean'),
('auto_backup_tables', '["agendamentos","pacientes","medicos","atendimentos","profiles","bloqueios_agenda","fila_espera","preparos","configuracoes_clinica"]', 'backup', 'Tabelas a incluir no backup', 'array'),
('session_timeout', '8', 'session', 'Timeout da sessão em horas', 'number'),
('enable_notifications', 'true', 'notifications', 'Habilitar notificações', 'boolean'),
('max_appointments_per_day', '20', 'performance', 'Máximo de agendamentos por médico por dia', 'number'),
('reminder_time', '24', 'notifications', 'Tempo de lembrete em horas', 'number');

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar configurações do sistema" 
ON public.system_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
);

CREATE POLICY "Usuários autenticados podem visualizar configurações" 
ON public.system_settings 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND editable = true
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Criar função para limpar backups antigos
CREATE OR REPLACE FUNCTION public.cleanup_old_backups_auto()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  max_backups INTEGER;
BEGIN
  -- Buscar configuração de quantos backups manter
  SELECT CAST(value AS INTEGER) INTO max_backups
  FROM public.system_settings 
  WHERE key = 'auto_backup_max_count'
  LIMIT 1;
  
  -- Padrão caso não encontre a configuração
  IF max_backups IS NULL THEN
    max_backups := 7;
  END IF;
  
  -- Deletar backups antigos, mantendo apenas os mais recentes
  DELETE FROM public.system_backups 
  WHERE id NOT IN (
    SELECT id 
    FROM public.system_backups 
    WHERE backup_type = 'automatic'
    ORDER BY created_at DESC 
    LIMIT max_backups
  ) AND backup_type = 'automatic';
  
  -- Log da limpeza
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context
  ) VALUES (
    now(),
    'info',
    FORMAT('Limpeza automática executada, mantidos %s backups', max_backups),
    'AUTO_BACKUP_CLEANUP'
  );
END;
$function$;

-- Habilitar extensões necessárias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;