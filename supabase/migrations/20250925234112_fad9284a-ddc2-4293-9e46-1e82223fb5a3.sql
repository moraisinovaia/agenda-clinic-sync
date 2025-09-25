-- Criar tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[], -- array com os campos que foram alterados
  ip_address INET,
  user_agent TEXT,
  session_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para admins verem todos os logs
CREATE POLICY "Admins podem ver todos os audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  )
);

-- Política para usuários verem logs relacionados aos seus agendamentos
CREATE POLICY "Usuários podem ver logs da sua clínica" 
ON public.audit_logs 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND
  (
    table_name = 'agendamentos' AND
    EXISTS (
      SELECT 1 FROM public.agendamentos a
      WHERE a.id = record_id::uuid 
      AND a.cliente_id = get_user_cliente_id()
    )
  )
);

-- Super admin pode ver tudo
CREATE POLICY "Super admin pode ver todos os audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (is_super_admin());

-- Permitir inserção de logs pelo sistema
CREATE POLICY "Sistema pode inserir audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(audit_timestamp DESC);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Função para capturar informações de auditoria
CREATE OR REPLACE FUNCTION public.audit_agendamentos() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_changed_fields TEXT[] := '{}';
  v_field TEXT;
  v_profile_name TEXT;
BEGIN
  -- Obter nome do usuário para contexto
  SELECT nome INTO v_profile_name 
  FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    
    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, 
      old_values, new_values, changed_fields,
      session_info
    ) VALUES (
      auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id,
      v_old_values, v_new_values, NULL,
      jsonb_build_object('profile_name', v_profile_name)
    );
    
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO public.audit_logs (
      user_id, action, table_name, record_id, 
      old_values, new_values, changed_fields,
      session_info
    ) VALUES (
      auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id,
      v_old_values, v_new_values, NULL,
      jsonb_build_object('profile_name', v_profile_name)
    );
    
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    -- Detectar campos alterados (apenas os importantes)
    IF OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento THEN
      v_changed_fields := array_append(v_changed_fields, 'data_agendamento');
    END IF;
    
    IF OLD.hora_agendamento IS DISTINCT FROM NEW.hora_agendamento THEN
      v_changed_fields := array_append(v_changed_fields, 'hora_agendamento');
    END IF;
    
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changed_fields := array_append(v_changed_fields, 'status');
    END IF;
    
    IF OLD.observacoes IS DISTINCT FROM NEW.observacoes THEN
      v_changed_fields := array_append(v_changed_fields, 'observacoes');
    END IF;
    
    IF OLD.medico_id IS DISTINCT FROM NEW.medico_id THEN
      v_changed_fields := array_append(v_changed_fields, 'medico_id');
    END IF;
    
    IF OLD.atendimento_id IS DISTINCT FROM NEW.atendimento_id THEN
      v_changed_fields := array_append(v_changed_fields, 'atendimento_id');
    END IF;
    
    IF OLD.paciente_id IS DISTINCT FROM NEW.paciente_id THEN
      v_changed_fields := array_append(v_changed_fields, 'paciente_id');
    END IF;

    -- Só registrar se houve mudanças reais
    IF array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO public.audit_logs (
        user_id, action, table_name, record_id, 
        old_values, new_values, changed_fields,
        session_info
      ) VALUES (
        auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id,
        v_old_values, v_new_values, v_changed_fields,
        jsonb_build_object('profile_name', v_profile_name)
      );
    END IF;
    
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Criar trigger para auditoria nos agendamentos
DROP TRIGGER IF EXISTS audit_agendamentos_trigger ON public.agendamentos;
CREATE TRIGGER audit_agendamentos_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.audit_agendamentos();

-- Função para buscar histórico de um agendamento
CREATE OR REPLACE FUNCTION public.get_agendamento_audit_history(p_agendamento_id UUID)
RETURNS TABLE(
  id UUID,
  audit_timestamp TIMESTAMP WITH TIME ZONE,
  action VARCHAR,
  user_name TEXT,
  changed_fields TEXT[],
  old_values JSONB,
  new_values JSONB,
  profile_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.audit_timestamp,
    al.action,
    p.nome as user_name,
    al.changed_fields,
    al.old_values,
    al.new_values,
    (al.session_info->>'profile_name')::TEXT as profile_name
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON al.user_id = p.user_id
  WHERE al.table_name = 'agendamentos' 
    AND al.record_id = p_agendamento_id
  ORDER BY al.audit_timestamp DESC;
END;
$$;