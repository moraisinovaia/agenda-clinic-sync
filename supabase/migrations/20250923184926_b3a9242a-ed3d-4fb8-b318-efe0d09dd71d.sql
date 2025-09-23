-- Corrigir as funções restantes sem search_path (sem índices concorrentes)
CREATE OR REPLACE FUNCTION public.cleanup_old_backups_auto()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_backups INTEGER;
BEGIN
  SELECT CAST(value AS INTEGER) INTO max_backups
  FROM public.system_settings 
  WHERE key = 'auto_backup_max_count'
  LIMIT 1;
  
  IF max_backups IS NULL THEN
    max_backups := 7;
  END IF;
  
  DELETE FROM public.system_backups 
  WHERE id NOT IN (
    SELECT id 
    FROM public.system_backups 
    WHERE backup_type = 'automatic'
    ORDER BY created_at DESC 
    LIMIT max_backups
  ) AND backup_type = 'automatic';
  
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
$$;

CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE(
  id uuid, 
  user_id uuid, 
  nome text, 
  email text, 
  username character varying, 
  role text, 
  created_at timestamp with time zone, 
  aprovado_por_nome text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.created_at,
    a.nome as aprovado_por_nome
  FROM public.profiles p
  LEFT JOIN public.profiles a ON p.aprovado_por = a.id
  WHERE p.status = 'pendente'
  ORDER BY p.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_system()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND status = 'aprovado'
  );
$$;

CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector, 
  match_count integer DEFAULT NULL::integer, 
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(id bigint, content text, metadata jsonb, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Criar configurações padrão do sistema de configurações se ainda não existirem
INSERT INTO public.system_settings (key, value, type, category, description, editable) VALUES
('session_timeout', '8', 'number', 'session', 'Timeout da sessão em horas', true),
('enable_notifications', 'true', 'boolean', 'notifications', 'Habilitar notificações', true),
('auto_backup_enabled', 'true', 'boolean', 'backup', 'Backup automático habilitado', true),
('auto_backup_interval', '24', 'number', 'backup', 'Intervalo de backup em horas', true),
('max_appointments_per_day', '20', 'number', 'performance', 'Máximo de agendamentos por dia', true),
('reminder_time', '24', 'number', 'notifications', 'Tempo de lembrete em horas', true),
('auto_backup_max_count', '7', 'number', 'backup', 'Máximo de backups a manter', true),
('auto_backup_include_data', 'true', 'boolean', 'backup', 'Incluir dados no backup', true),
('auto_backup_include_schema', 'true', 'boolean', 'backup', 'Incluir schema no backup', true)
ON CONFLICT (key) DO NOTHING;

-- Otimizar índices para melhor performance (sem CONCURRENTLY)
CREATE INDEX IF NOT EXISTS idx_agendamentos_medico_data 
ON public.agendamentos(medico_id, data_agendamento);

CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente 
ON public.agendamentos(paciente_id);

CREATE INDEX IF NOT EXISTS idx_profiles_user_status 
ON public.profiles(user_id, status);

CREATE INDEX IF NOT EXISTS idx_fila_espera_medico_status 
ON public.fila_espera(medico_id, status, data_preferida);

-- Adicionar políticas de segurança mais restritivas para tabelas críticas
CREATE POLICY "Limitar acesso de leitura por cliente" 
ON public.system_settings 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  (editable = true OR is_admin_user())
);

-- Melhorar política de acesso aos logs do sistema
DROP POLICY IF EXISTS "Admins podem ver todos os logs" ON public.system_logs;
CREATE POLICY "Admins podem ver todos os logs" 
ON public.system_logs 
FOR SELECT 
USING (
  is_admin_user() OR 
  user_id = auth.uid()
);