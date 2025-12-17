-- ============= FASE 5: RPCs SECURITY DEFINER para LLM API =============
-- DROP das funções existentes para permitir alteração de return type

DROP FUNCTION IF EXISTS public.get_llm_clinic_config(uuid);
DROP FUNCTION IF EXISTS public.get_llm_business_rules(uuid);
DROP FUNCTION IF EXISTS public.get_llm_mensagens(uuid, uuid, text);

-- 1. Buscar configuração da clínica (substitui constantes hardcoded)
CREATE OR REPLACE FUNCTION public.get_llm_clinic_config(p_cliente_id uuid)
RETURNS TABLE (
  id uuid,
  nome_clinica text,
  telefone text,
  whatsapp text,
  endereco text,
  data_minima_agendamento date,
  dias_busca_inicial integer,
  dias_busca_expandida integer,
  mensagem_bloqueio_padrao text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, 
    c.nome_clinica, 
    c.telefone, 
    c.whatsapp, 
    c.endereco,
    c.data_minima_agendamento, 
    c.dias_busca_inicial, 
    c.dias_busca_expandida,
    c.mensagem_bloqueio_padrao
  FROM public.llm_clinic_config c
  WHERE c.cliente_id = p_cliente_id AND c.ativo = true
  LIMIT 1;
END;
$$;

-- 2. Buscar regras de negócio por cliente (substitui BUSINESS_RULES.medicos)
CREATE OR REPLACE FUNCTION public.get_llm_business_rules(p_cliente_id uuid)
RETURNS TABLE (
  medico_id uuid,
  medico_nome text,
  config jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    br.medico_id, 
    m.nome as medico_nome,
    br.config
  FROM public.business_rules br
  JOIN public.medicos m ON m.id = br.medico_id
  WHERE br.cliente_id = p_cliente_id AND br.ativo = true;
END;
$$;

-- 3. Buscar mensagens personalizadas (substitui getMigrationBlockMessage hardcoded)
CREATE OR REPLACE FUNCTION public.get_llm_mensagens(p_cliente_id uuid, p_medico_id uuid DEFAULT NULL, p_tipo text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  tipo text,
  medico_id uuid,
  mensagem text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id, 
    m.tipo, 
    m.medico_id, 
    m.mensagem
  FROM public.llm_mensagens m
  WHERE m.cliente_id = p_cliente_id 
    AND m.ativo = true
    AND (p_medico_id IS NULL OR m.medico_id IS NULL OR m.medico_id = p_medico_id)
    AND (p_tipo IS NULL OR m.tipo = p_tipo);
END;
$$;