-- Criar tabela para metadados de backup
CREATE TABLE IF NOT EXISTS public.system_backups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  status varchar(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  backup_type varchar(20) NOT NULL CHECK (backup_type IN ('manual', 'scheduled', 'emergency')),
  table_count integer DEFAULT 0,
  data_size bigint DEFAULT 0,
  config jsonb,
  metadata jsonb,
  error_message text,
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days')
);

-- Índices para system_backups
CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON public.system_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_system_backups_status ON public.system_backups(status);
CREATE INDEX IF NOT EXISTS idx_system_backups_type ON public.system_backups(backup_type);

-- RLS para system_backups (apenas admins)
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar backups" ON public.system_backups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'aprovado'
    )
  );

-- Função para limpeza automática de backups expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_backups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.system_backups 
  WHERE expires_at < now();
  
  -- Log da limpeza
  INSERT INTO public.system_logs (
    timestamp,
    level,
    message,
    context,
    created_at
  ) VALUES (
    now(),
    'info',
    'Limpeza automática de backups expirados executada',
    'BACKUP_CLEANUP',
    now()
  );
END;
$$;

-- Tabela para monitoramento de sistema
CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamp with time zone DEFAULT now(),
  metric_name varchar(50) NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit varchar(20),
  context jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para system_health
CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON public.system_health(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_health_metric ON public.system_health(metric_name);

-- RLS para system_health (apenas admins podem ver)
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver métricas de sistema" ON public.system_health
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'aprovado'
    )
  );

-- Política para inserção via edge functions
CREATE POLICY "Service role pode inserir métricas" ON public.system_health
  FOR INSERT WITH CHECK (true);