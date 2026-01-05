
-- Corrigir recursão infinita entre triggers de sincronização médico <-> business_rules

-- 1. Recriar função sync_medico_to_business_rules com proteção contra recursão
CREATE OR REPLACE FUNCTION public.sync_medico_to_business_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se já estamos em uma sincronização para evitar loop
  IF current_setting('app.syncing_medico_rules', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Marcar que estamos sincronizando
  PERFORM set_config('app.syncing_medico_rules', 'true', true);
  
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
  
  -- Limpar flag
  PERFORM set_config('app.syncing_medico_rules', 'false', true);
  
  RETURN NEW;
END;
$$;

-- 2. Recriar função sync_business_rules_to_medico com proteção contra recursão
CREATE OR REPLACE FUNCTION public.sync_business_rules_to_medico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idade_minima INTEGER;
  v_idade_maxima INTEGER;
  v_convenios TEXT[];
BEGIN
  -- Verificar se já estamos em uma sincronização para evitar loop
  IF current_setting('app.syncing_medico_rules', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Marcar que estamos sincronizando
  PERFORM set_config('app.syncing_medico_rules', 'true', true);
  
  -- Extrair valores do config JSON
  v_idade_minima := (NEW.config->>'idade_minima')::INTEGER;
  v_idade_maxima := (NEW.config->>'idade_maxima')::INTEGER;
  
  -- Extrair array de convênios
  IF NEW.config ? 'convenios_aceitos' AND jsonb_typeof(NEW.config->'convenios_aceitos') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_convenios
    FROM jsonb_array_elements_text(NEW.config->'convenios_aceitos') AS elem;
  END IF;
  
  -- Atualizar tabela medicos
  UPDATE public.medicos
  SET 
    idade_minima = COALESCE(v_idade_minima, idade_minima),
    idade_maxima = COALESCE(v_idade_maxima, idade_maxima),
    convenios_aceitos = COALESCE(v_convenios, convenios_aceitos),
    updated_at = now()
  WHERE id = NEW.medico_id;
  
  -- Limpar flag
  PERFORM set_config('app.syncing_medico_rules', 'false', true);
  
  RETURN NEW;
END;
$$;

-- 3. Garantir que o trigger em business_rules existe e está corretamente configurado
DROP TRIGGER IF EXISTS sync_business_rules_to_medico_trigger ON public.business_rules;
CREATE TRIGGER sync_business_rules_to_medico_trigger
  AFTER UPDATE ON public.business_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_business_rules_to_medico();
