-- ===================================================================
-- FASE 1: ESTRUTURA DE DADOS - LLM API DINÂMICA
-- Versão: Production-Ready com todas as correções
-- ===================================================================

-- ===================================================================
-- 1. TABELA: business_rules
-- Armazena as regras de negócio de cada médico em JSONB
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT business_rules_unique UNIQUE(cliente_id, medico_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_business_rules_cliente 
  ON business_rules(cliente_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_medico 
  ON business_rules(medico_id);
CREATE INDEX IF NOT EXISTS idx_business_rules_config 
  ON business_rules USING GIN(config);
CREATE INDEX IF NOT EXISTS idx_business_rules_ativo 
  ON business_rules(ativo) WHERE ativo = true;

-- Comentários
COMMENT ON TABLE business_rules IS 'Regras de negócio dinâmicas para LLM APIs';
COMMENT ON COLUMN business_rules.config IS 'Estrutura JSONB com servicos, periodos, limites, etc';
COMMENT ON COLUMN business_rules.version IS 'Versão incremental para rollback';

-- ===================================================================
-- 2. TABELA: business_rules_audit
-- Auditoria completa de todas as mudanças (com cliente_id denormalizado)
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.business_rules_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_rule_id UUID REFERENCES business_rules(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES clientes(id), -- Denormalizado para queries eficientes
  changed_by UUID,
  changed_by_name TEXT,
  old_config JSONB,
  new_config JSONB,
  motivo TEXT,
  ip_address INET,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_business_rule 
  ON business_rules_audit(business_rule_id);
CREATE INDEX IF NOT EXISTS idx_audit_cliente 
  ON business_rules_audit(cliente_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at 
  ON business_rules_audit(changed_at DESC);

-- Comentários
COMMENT ON TABLE business_rules_audit IS 'Histórico de alterações em business_rules';
COMMENT ON COLUMN business_rules_audit.cliente_id IS 'Denormalizado para queries eficientes mesmo após deleção de business_rule';
COMMENT ON COLUMN business_rules_audit.motivo IS 'Motivo da alteração fornecido pelo admin';

-- ===================================================================
-- 3. TABELA: llm_clinic_config
-- Configurações globais de cada clínica
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.llm_clinic_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE UNIQUE,
  nome_clinica TEXT NOT NULL,
  telefone TEXT,
  whatsapp TEXT,
  endereco TEXT,
  data_minima_agendamento DATE DEFAULT '2026-01-01',
  mensagem_bloqueio_padrao TEXT,
  dias_busca_inicial INTEGER DEFAULT 14 CHECK (dias_busca_inicial > 0),
  dias_busca_expandida INTEGER DEFAULT 45 CHECK (dias_busca_expandida >= dias_busca_inicial),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_llm_clinic_config_cliente 
  ON llm_clinic_config(cliente_id);

-- Comentários
COMMENT ON TABLE llm_clinic_config IS 'Configurações globais da clínica para LLM API';
COMMENT ON COLUMN llm_clinic_config.data_minima_agendamento IS 'Data mínima permitida para agendamentos (migração)';
COMMENT ON COLUMN llm_clinic_config.dias_busca_inicial IS 'Quantidade de dias para busca inicial de disponibilidade';
COMMENT ON COLUMN llm_clinic_config.dias_busca_expandida IS 'Quantidade de dias para busca expandida quando não acha vagas';

-- ===================================================================
-- 4. TABELA: llm_mensagens
-- Mensagens personalizadas por médico ou globais
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.llm_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  medico_id UUID REFERENCES medicos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('bloqueio', 'sem_vaga', 'encaixe', 'preparo', 'confirmacao')),
  mensagem TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_llm_mensagens_cliente 
  ON llm_mensagens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_llm_mensagens_medico 
  ON llm_mensagens(medico_id) WHERE medico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_mensagens_tipo 
  ON llm_mensagens(tipo);

-- Comentários
COMMENT ON TABLE llm_mensagens IS 'Mensagens personalizadas para LLM API';
COMMENT ON COLUMN llm_mensagens.medico_id IS 'NULL = mensagem global da clínica, UUID = específica do médico';
COMMENT ON COLUMN llm_mensagens.tipo IS 'Tipo de mensagem: bloqueio, sem_vaga, encaixe, preparo, confirmacao';

-- ===================================================================
-- 5. ROW LEVEL SECURITY (RLS) - Com super_admin e WITH CHECK
-- ===================================================================

-- business_rules
ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin pode gerenciar business_rules" ON business_rules;
CREATE POLICY "Super admin pode gerenciar business_rules" ON business_rules
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Admin pode gerenciar business_rules" ON business_rules;
CREATE POLICY "Admin pode gerenciar business_rules" ON business_rules
  FOR ALL
  USING (
    cliente_id = get_user_cliente_id() AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
  )
  WITH CHECK (
    cliente_id = get_user_cliente_id() AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
  );

-- business_rules_audit (somente leitura, com suporte a registros órfãos)
ALTER TABLE business_rules_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin pode ver todo audit" ON business_rules_audit;
CREATE POLICY "Super admin pode ver todo audit" ON business_rules_audit
  FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Admin pode ver audit" ON business_rules_audit;
CREATE POLICY "Admin pode ver audit" ON business_rules_audit
  FOR SELECT
  USING (
    (
      -- Registros com business_rule existente
      EXISTS (
        SELECT 1 FROM business_rules br 
        WHERE br.id = business_rules_audit.business_rule_id
          AND br.cliente_id = get_user_cliente_id()
      )
      OR
      -- Registros órfãos (business_rule deletada) - usa cliente_id denormalizado
      (business_rules_audit.business_rule_id IS NULL AND business_rules_audit.cliente_id = get_user_cliente_id())
    ) AND
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
  );

-- llm_clinic_config
ALTER TABLE llm_clinic_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin pode gerenciar llm_clinic_config" ON llm_clinic_config;
CREATE POLICY "Super admin pode gerenciar llm_clinic_config" ON llm_clinic_config
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Admin pode gerenciar llm_clinic_config" ON llm_clinic_config;
CREATE POLICY "Admin pode gerenciar llm_clinic_config" ON llm_clinic_config
  FOR ALL
  USING (
    cliente_id = get_user_cliente_id() AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
  )
  WITH CHECK (
    cliente_id = get_user_cliente_id() AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
  );

-- llm_mensagens
ALTER TABLE llm_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin pode gerenciar llm_mensagens" ON llm_mensagens;
CREATE POLICY "Super admin pode gerenciar llm_mensagens" ON llm_mensagens
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Admin pode gerenciar llm_mensagens" ON llm_mensagens;
CREATE POLICY "Admin pode gerenciar llm_mensagens" ON llm_mensagens
  FOR ALL
  USING (
    cliente_id = get_user_cliente_id() AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
  )
  WITH CHECK (
    cliente_id = get_user_cliente_id() AND 
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'admin_clinica'))
  );

-- ===================================================================
-- 6. TRIGGERS
-- ===================================================================

-- Trigger 1: Auditoria de mudanças (com cliente_id denormalizado)
CREATE OR REPLACE FUNCTION audit_business_rules_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO business_rules_audit (
      business_rule_id,
      cliente_id,
      changed_by,
      changed_by_name,
      old_config,
      new_config,
      ip_address
    )
    SELECT 
      NEW.id,
      NEW.cliente_id,
      auth.uid(),
      (SELECT nome FROM profiles WHERE user_id = auth.uid() LIMIT 1),
      OLD.config,
      NEW.config,
      COALESCE(inet_client_addr(), '0.0.0.0'::inet);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS business_rules_audit_trigger ON business_rules;
CREATE TRIGGER business_rules_audit_trigger
AFTER UPDATE ON business_rules
FOR EACH ROW 
WHEN (OLD.config IS DISTINCT FROM NEW.config)
EXECUTE FUNCTION audit_business_rules_change();

-- Trigger 2: Incrementar versão automaticamente
CREATE OR REPLACE FUNCTION increment_business_rules_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version = OLD.version + 1;
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS business_rules_version_trigger ON business_rules;
CREATE TRIGGER business_rules_version_trigger
BEFORE UPDATE ON business_rules
FOR EACH ROW EXECUTE FUNCTION increment_business_rules_version();

-- Trigger 3: Atualizar updated_at em llm_clinic_config
CREATE OR REPLACE FUNCTION update_llm_clinic_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS llm_clinic_config_updated_at ON llm_clinic_config;
CREATE TRIGGER llm_clinic_config_updated_at
BEFORE UPDATE ON llm_clinic_config
FOR EACH ROW EXECUTE FUNCTION update_llm_clinic_config_updated_at();

-- ===================================================================
-- 7. GRANTS (Permissões)
-- ===================================================================

GRANT ALL ON business_rules TO service_role;
GRANT ALL ON business_rules_audit TO service_role;
GRANT ALL ON llm_clinic_config TO service_role;
GRANT ALL ON llm_mensagens TO service_role;

GRANT SELECT, INSERT, UPDATE ON business_rules TO authenticated;
GRANT SELECT ON business_rules_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE ON llm_clinic_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON llm_mensagens TO authenticated;

-- ===================================================================
-- 8. FUNÇÕES HELPER (SECURITY DEFINER para Edge Functions)
-- ===================================================================

-- Função para buscar business_rules por cliente (para Edge Functions)
CREATE OR REPLACE FUNCTION get_business_rules_by_cliente(p_cliente_id UUID)
RETURNS TABLE (
  id UUID,
  medico_id UUID,
  medico_nome TEXT,
  config JSONB,
  version INTEGER,
  ativo BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    br.id,
    br.medico_id,
    m.nome::TEXT as medico_nome,
    br.config,
    br.version,
    br.ativo
  FROM business_rules br
  JOIN medicos m ON m.id = br.medico_id
  WHERE br.cliente_id = p_cliente_id
    AND br.ativo = true
  ORDER BY m.nome;
$$;

-- Função para buscar config da clínica (para Edge Functions)
CREATE OR REPLACE FUNCTION get_llm_clinic_config(p_cliente_id UUID)
RETURNS TABLE (
  id UUID,
  nome_clinica TEXT,
  telefone TEXT,
  whatsapp TEXT,
  endereco TEXT,
  data_minima_agendamento DATE,
  mensagem_bloqueio_padrao TEXT,
  dias_busca_inicial INTEGER,
  dias_busca_expandida INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    nome_clinica,
    telefone,
    whatsapp,
    endereco,
    data_minima_agendamento,
    mensagem_bloqueio_padrao,
    dias_busca_inicial,
    dias_busca_expandida
  FROM llm_clinic_config
  WHERE cliente_id = p_cliente_id
    AND ativo = true
  LIMIT 1;
$$;

-- Função para buscar mensagens personalizadas (para Edge Functions)
CREATE OR REPLACE FUNCTION get_llm_mensagens(
  p_cliente_id UUID,
  p_medico_id UUID DEFAULT NULL,
  p_tipo TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  medico_id UUID,
  tipo TEXT,
  mensagem TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    medico_id,
    tipo,
    mensagem
  FROM llm_mensagens
  WHERE cliente_id = p_cliente_id
    AND ativo = true
    AND (p_medico_id IS NULL OR medico_id = p_medico_id OR medico_id IS NULL)
    AND (p_tipo IS NULL OR tipo = p_tipo)
  ORDER BY medico_id NULLS LAST, tipo;
$$;

-- ===================================================================
-- 9. LOG DA OPERAÇÃO
-- ===================================================================

INSERT INTO public.system_logs (timestamp, level, message, context, data)
VALUES (
  now(),
  'info',
  '[DATABASE] Fase 1 LLM API Dinâmica - Estrutura de dados criada',
  'LLM_API_MIGRATION',
  jsonb_build_object(
    'fase', 1,
    'tabelas_criadas', ARRAY['business_rules', 'business_rules_audit', 'llm_clinic_config', 'llm_mensagens'],
    'funcoes_criadas', ARRAY['get_business_rules_by_cliente', 'get_llm_clinic_config', 'get_llm_mensagens'],
    'triggers_criados', ARRAY['business_rules_audit_trigger', 'business_rules_version_trigger', 'llm_clinic_config_updated_at'],
    'timestamp', now()
  )
);