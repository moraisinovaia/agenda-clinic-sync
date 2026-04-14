
CREATE OR REPLACE FUNCTION public.criar_cliente(
  p_nome text,
  p_admin_user_id uuid DEFAULT NULL,
  p_parceiro_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_parceiro_id uuid;
  v_parceiro_nome text;
BEGIN
  -- Verificar permissão
  IF p_admin_user_id IS NOT NULL THEN
    IF NOT (public.has_role(p_admin_user_id, 'admin') OR public.has_role(p_admin_user_id, 'super_admin')) THEN
      RETURN json_build_object('success', false, 'error', 'Apenas administradores podem criar clientes');
    END IF;
  END IF;

  -- Verificar duplicata
  IF EXISTS (SELECT 1 FROM public.clientes WHERE nome = p_nome) THEN
    RETURN json_build_object('success', false, 'error', 'Já existe um cliente com este nome');
  END IF;

  -- Determinar parceiro_id
  IF p_parceiro_id IS NOT NULL THEN
    v_parceiro_id := p_parceiro_id;
  ELSE
    -- Tentar derivar do perfil do admin
    SELECT pr.parceiro_id INTO v_parceiro_id
    FROM public.profiles pr
    WHERE pr.user_id = p_admin_user_id;
    
    -- Fallback para INOVAIA
    IF v_parceiro_id IS NULL THEN
      SELECT id INTO v_parceiro_id FROM public.parceiros WHERE slug = 'inovaia' LIMIT 1;
    END IF;
  END IF;

  -- Buscar nome do parceiro
  SELECT nome INTO v_parceiro_nome FROM public.parceiros WHERE id = v_parceiro_id;

  -- Criar cliente com parceiro_id
  INSERT INTO public.clientes (nome, ativo, configuracoes, parceiro_id, parceiro)
  VALUES (p_nome, true, '{"tipo": "clinica"}'::jsonb, v_parceiro_id, v_parceiro_nome)
  RETURNING id INTO v_cliente_id;

  RETURN json_build_object('success', true, 'cliente_id', v_cliente_id, 'message', 'Cliente criado com sucesso');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Erro: ' || SQLERRM);
END;
$$;
