-- Corrigir search_path nas funções de trigger da Fase 1

CREATE OR REPLACE FUNCTION audit_business_rules_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.business_rules_audit (
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
      (SELECT nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
      OLD.config,
      NEW.config,
      COALESCE(inet_client_addr(), '0.0.0.0'::inet);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_business_rules_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version = OLD.version + 1;
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION update_llm_clinic_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;