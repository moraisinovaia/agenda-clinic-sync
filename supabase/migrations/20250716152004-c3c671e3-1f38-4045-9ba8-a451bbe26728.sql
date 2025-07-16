-- Criar tabela para logs do sistema
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamp with time zone NOT NULL,
  level varchar(10) NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message text NOT NULL,
  data jsonb,
  context varchar(50),
  user_id uuid,
  session_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_context ON public.system_logs(context);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs(user_id);

-- RLS para system_logs (apenas admins podem ver logs)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os logs" ON public.system_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'aprovado'
    )
  );

-- Política para inserção via edge function (service role)
CREATE POLICY "Service role pode inserir logs" ON public.system_logs
  FOR INSERT WITH CHECK (true);

-- Função para limpeza automática de logs antigos (manter apenas 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.system_logs 
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- Configurações de produção adicionais
INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras) 
VALUES 
  ('system_log_retention_days', '30', 'system', true, '{"description": "Dias para manter logs do sistema"}'),
  ('performance_monitoring', 'enabled', 'system', true, '{"description": "Monitoramento de performance habilitado"}'),
  ('error_tracking', 'enabled', 'system', true, '{"description": "Rastreamento de erros habilitado"}'),
  ('cache_ttl_minutes', '30', 'performance', true, '{"description": "TTL do cache em minutos"}'),
  ('max_items_per_page', '50', 'ui', true, '{"description": "Máximo de itens por página"}')
ON CONFLICT (chave) DO UPDATE SET
  valor = EXCLUDED.valor,
  dados_extras = EXCLUDED.dados_extras;