-- Adicionar campos CRM e RQE na tabela medicos
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS crm VARCHAR(20);
ALTER TABLE public.medicos ADD COLUMN IF NOT EXISTS rqe VARCHAR(20);

-- Criar índice para busca por CRM
CREATE INDEX IF NOT EXISTS idx_medicos_crm ON public.medicos(crm);

-- Função para sincronizar medicos -> business_rules quando médico é atualizado
CREATE OR REPLACE FUNCTION sync_medico_to_business_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar business_rules.config com dados do médico
  UPDATE public.business_rules
  SET config = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{idade_minima}',
        COALESCE(to_jsonb(NEW.idade_minima), 'null'::jsonb)
      ),
      '{idade_maxima}',
      COALESCE(to_jsonb(NEW.idade_maxima), 'null'::jsonb)
    ),
    '{convenios_aceitos}',
    COALESCE(to_jsonb(NEW.convenios_aceitos), '[]'::jsonb)
  ),
  updated_at = now()
  WHERE medico_id = NEW.id AND ativo = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para sincronizar medicos -> business_rules
DROP TRIGGER IF EXISTS trigger_sync_medico_to_business_rules ON public.medicos;
CREATE TRIGGER trigger_sync_medico_to_business_rules
  AFTER UPDATE OF idade_minima, idade_maxima, convenios_aceitos ON public.medicos
  FOR EACH ROW
  EXECUTE FUNCTION sync_medico_to_business_rules();

-- Função para sincronizar business_rules -> medicos quando config é atualizada
CREATE OR REPLACE FUNCTION sync_business_rules_to_medico()
RETURNS TRIGGER AS $$
DECLARE
  v_idade_minima INTEGER;
  v_idade_maxima INTEGER;
  v_convenios TEXT[];
BEGIN
  -- Extrair valores do config JSON
  v_idade_minima := (NEW.config->>'idade_minima')::INTEGER;
  v_idade_maxima := (NEW.config->>'idade_maxima')::INTEGER;
  
  -- Extrair array de convênios
  IF NEW.config ? 'convenios_aceitos' AND jsonb_typeof(NEW.config->'convenios_aceitos') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_convenios
    FROM jsonb_array_elements_text(NEW.config->'convenios_aceitos') AS elem;
  END IF;
  
  -- Atualizar tabela medicos (desabilitar trigger para evitar loop)
  UPDATE public.medicos
  SET 
    idade_minima = COALESCE(v_idade_minima, idade_minima),
    idade_maxima = COALESCE(v_idade_maxima, idade_maxima),
    convenios_aceitos = COALESCE(v_convenios, convenios_aceitos),
    updated_at = now()
  WHERE id = NEW.medico_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para sincronizar business_rules -> medicos
DROP TRIGGER IF EXISTS trigger_sync_business_rules_to_medico ON public.business_rules;
CREATE TRIGGER trigger_sync_business_rules_to_medico
  AFTER INSERT OR UPDATE OF config ON public.business_rules
  FOR EACH ROW
  WHEN (NEW.ativo = true)
  EXECUTE FUNCTION sync_business_rules_to_medico();