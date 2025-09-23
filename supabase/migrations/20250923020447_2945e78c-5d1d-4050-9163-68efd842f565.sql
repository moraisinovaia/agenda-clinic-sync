-- PHASE 2: Performance Optimization & Multi-Tenant Enhancements

-- 1. PERFORMANCE INDEXES
-- Índices otimizados para consultas com cliente_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agendamentos_cliente_data 
ON public.agendamentos (cliente_id, data_agendamento, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agendamentos_cliente_medico_data 
ON public.agendamentos (cliente_id, medico_id, data_agendamento);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pacientes_cliente_nome 
ON public.pacientes (cliente_id, nome_completo);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_cliente_status 
ON public.profiles (cliente_id, status, role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicos_cliente_ativo 
ON public.medicos (cliente_id, ativo);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_atendimentos_cliente_ativo 
ON public.atendimentos (cliente_id, ativo);

-- 2. MULTI-TENANT CONFIGURATIONS TABLE
CREATE TABLE IF NOT EXISTS public.client_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  key VARCHAR(200) NOT NULL,
  value TEXT NOT NULL,
  value_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  editable BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(cliente_id, category, key)
);

-- Enable RLS
ALTER TABLE public.client_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policy for client_configurations
CREATE POLICY "Configurações - visualizar da clínica" 
ON public.client_configurations 
FOR SELECT 
USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Configurações - gerenciar da clínica" 
ON public.client_configurations 
FOR ALL 
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL)
WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- 3. CLIENT USAGE METRICS TABLE
CREATE TABLE IF NOT EXISTS public.client_usage_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_agendamentos INTEGER DEFAULT 0,
  agendamentos_criados INTEGER DEFAULT 0,
  agendamentos_cancelados INTEGER DEFAULT 0,
  agendamentos_confirmados INTEGER DEFAULT 0,
  usuarios_ativos INTEGER DEFAULT 0,
  pacientes_cadastrados INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(cliente_id, metric_date)
);

-- Enable RLS
ALTER TABLE public.client_usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy for client_usage_metrics
CREATE POLICY "Métricas - visualizar da clínica" 
ON public.client_usage_metrics 
FOR SELECT 
USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Admins podem inserir métricas" 
ON public.client_usage_metrics 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. CLIENT AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.client_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for client_audit_logs
CREATE POLICY "Logs auditoria - visualizar da clínica" 
ON public.client_audit_logs 
FOR SELECT 
USING (cliente_id = get_user_cliente_id());

CREATE POLICY "Service role pode inserir logs auditoria" 
ON public.client_audit_logs 
FOR INSERT 
WITH CHECK (true);

-- 5. FUNCTION TO UPDATE CLIENT METRICS
CREATE OR REPLACE FUNCTION public.update_client_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_record RECORD;
BEGIN
  -- Atualizar métricas para cada cliente
  FOR client_record IN SELECT id FROM public.clientes WHERE ativo = true
  LOOP
    INSERT INTO public.client_usage_metrics (
      cliente_id,
      metric_date,
      total_agendamentos,
      agendamentos_criados,
      agendamentos_cancelados,
      agendamentos_confirmados,
      usuarios_ativos,
      pacientes_cadastrados
    )
    SELECT 
      client_record.id,
      CURRENT_DATE,
      COUNT(*) FILTER (WHERE status IN ('agendado', 'confirmado', 'cancelado')),
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
      COUNT(*) FILTER (WHERE status = 'cancelado' AND DATE(updated_at) = CURRENT_DATE),
      COUNT(*) FILTER (WHERE status = 'confirmado' AND DATE(updated_at) = CURRENT_DATE),
      (SELECT COUNT(DISTINCT user_id) FROM public.profiles WHERE cliente_id = client_record.id AND status = 'aprovado'),
      (SELECT COUNT(*) FROM public.pacientes WHERE cliente_id = client_record.id)
    FROM public.agendamentos 
    WHERE cliente_id = client_record.id
    ON CONFLICT (cliente_id, metric_date) DO UPDATE SET
      total_agendamentos = EXCLUDED.total_agendamentos,
      agendamentos_criados = EXCLUDED.agendamentos_criados,
      agendamentos_cancelados = EXCLUDED.agendamentos_cancelados,
      agendamentos_confirmados = EXCLUDED.agendamentos_confirmados,
      usuarios_ativos = EXCLUDED.usuarios_ativos,
      pacientes_cadastrados = EXCLUDED.pacientes_cadastrados,
      updated_at = now();
  END LOOP;
END;
$$;

-- 6. TRIGGER FOR UPDATED_AT ON NEW TABLES
CREATE TRIGGER update_client_configurations_updated_at
BEFORE UPDATE ON public.client_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_usage_metrics_updated_at
BEFORE UPDATE ON public.client_usage_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. INSERT DEFAULT CONFIGURATIONS FOR EXISTING CLIENTS
INSERT INTO public.client_configurations (cliente_id, category, key, value, description)
SELECT 
  id,
  'interface',
  'theme_color',
  '#0ea5e9',
  'Cor principal da interface'
FROM public.clientes 
WHERE ativo = true
ON CONFLICT (cliente_id, category, key) DO NOTHING;

INSERT INTO public.client_configurations (cliente_id, category, key, value, description)
SELECT 
  id,
  'scheduling',
  'max_appointments_per_day',
  '40',
  'Máximo de agendamentos por médico por dia'
FROM public.clientes 
WHERE ativo = true
ON CONFLICT (cliente_id, category, key) DO NOTHING;

INSERT INTO public.client_configurations (cliente_id, category, key, value, description)
SELECT 
  id,
  'notifications',
  'whatsapp_enabled',
  'true',
  'Habilitar notificações via WhatsApp'
FROM public.clientes 
WHERE ativo = true
ON CONFLICT (cliente_id, category, key) DO NOTHING;