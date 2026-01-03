-- Criar tabela system_backups para o sistema de backup automático
CREATE TABLE IF NOT EXISTS public.system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  backup_type TEXT NOT NULL DEFAULT 'manual',
  table_count INTEGER DEFAULT 0,
  data_size BIGINT DEFAULT 0,
  config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  error_message TEXT,
  completed_at TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

-- Policy para admins gerenciarem backups
CREATE POLICY "Admins can manage backups" ON public.system_backups
  FOR ALL TO authenticated
  USING (is_admin_user() OR is_super_admin())
  WITH CHECK (is_admin_user() OR is_super_admin());

-- Policy para service_role (edge functions) ter acesso total
CREATE POLICY "Service role full access to backups" ON public.system_backups
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Adicionar policy para service_role acessar system_settings
CREATE POLICY "Service role can read settings" ON public.system_settings
  FOR SELECT TO service_role
  USING (true);