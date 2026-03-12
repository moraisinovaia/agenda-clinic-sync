DROP FUNCTION IF EXISTS public.check_tenant_limit(text);

CREATE OR REPLACE FUNCTION public.check_tenant_limit(p_tipo text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_plano record;
  v_count int;
  v_max int;
  v_label text;
BEGIN
  v_cliente_id := get_user_cliente_id();
  IF v_cliente_id IS NULL THEN
    RETURN json_build_object('allowed', true, 'current', 0, 'max', 0, 'message', '');
  END IF;

  SELECT * INTO v_plano FROM planos_assinatura
  WHERE cliente_id = v_cliente_id AND status IN ('ativo', 'trial') LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', true, 'current', 0, 'max', 0, 'message', '');
  END IF;

  CASE p_tipo
    WHEN 'medicos' THEN
      SELECT count(*) INTO v_count FROM medicos WHERE cliente_id = v_cliente_id AND ativo = true;
      v_max := v_plano.max_medicos;
      v_label := 'médicos';
    WHEN 'usuarios' THEN
      SELECT count(*) INTO v_count FROM profiles WHERE cliente_id = v_cliente_id AND ativo = true;
      v_max := v_plano.max_usuarios;
      v_label := 'usuários';
    WHEN 'pacientes' THEN
      SELECT count(*) INTO v_count FROM pacientes WHERE cliente_id = v_cliente_id;
      v_max := v_plano.max_pacientes;
      v_label := 'pacientes';
    ELSE
      RETURN json_build_object('allowed', true, 'current', 0, 'max', 0, 'message', '');
  END CASE;

  IF v_count >= v_max THEN
    RETURN json_build_object(
      'allowed', false,
      'current', v_count,
      'max', v_max,
      'message', format('Limite de %s atingido (%s/%s). Atualize seu plano.', v_label, v_count, v_max)
    );
  END IF;

  RETURN json_build_object('allowed', true, 'current', v_count, 'max', v_max, 'message', '');
END;
$$;