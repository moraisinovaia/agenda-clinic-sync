-- Adicionar campos de contato à tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT;

-- Atualizar função atualizar_cliente para incluir novos campos
DROP FUNCTION IF EXISTS public.atualizar_cliente(uuid, text, boolean, uuid);

CREATE OR REPLACE FUNCTION public.atualizar_cliente(
  p_cliente_id uuid,
  p_nome text DEFAULT NULL,
  p_ativo boolean DEFAULT NULL,
  p_admin_user_id uuid DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  -- Verificar se usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = COALESCE(p_admin_user_id, auth.uid()) 
    AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado: apenas administradores podem atualizar clientes');
  END IF;

  -- Atualizar cliente com campos fornecidos
  UPDATE public.clientes
  SET
    nome = COALESCE(p_nome, nome),
    ativo = COALESCE(p_ativo, ativo),
    telefone = COALESCE(p_telefone, telefone),
    whatsapp = COALESCE(p_whatsapp, whatsapp),
    endereco = COALESCE(p_endereco, endereco),
    logo_url = COALESCE(p_logo_url, logo_url),
    updated_at = now()
  WHERE id = p_cliente_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Log da ação
  INSERT INTO public.system_logs (level, message, context, timestamp, data)
  VALUES (
    'info',
    'Cliente atualizado: ' || p_cliente_id,
    'atualizar_cliente',
    now(),
    json_build_object(
      'cliente_id', p_cliente_id,
      'admin_user_id', COALESCE(p_admin_user_id, auth.uid())
    )
  );

  RETURN json_build_object('success', true, 'cliente_id', p_cliente_id);
END;
$$;

-- Criar função para buscar cliente completo com config LLM
CREATE OR REPLACE FUNCTION public.get_cliente_completo(p_cliente_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente json;
  v_llm_config json;
BEGIN
  -- Buscar dados do cliente
  SELECT json_build_object(
    'id', c.id,
    'nome', c.nome,
    'telefone', c.telefone,
    'whatsapp', c.whatsapp,
    'endereco', c.endereco,
    'logo_url', c.logo_url,
    'ativo', c.ativo,
    'created_at', c.created_at
  ) INTO v_cliente
  FROM public.clientes c
  WHERE c.id = p_cliente_id;

  -- Buscar config LLM se existir
  SELECT json_build_object(
    'id', l.id,
    'nome_clinica', l.nome_clinica,
    'data_minima_agendamento', l.data_minima_agendamento,
    'dias_busca_inicial', l.dias_busca_inicial,
    'dias_busca_expandida', l.dias_busca_expandida,
    'mensagem_bloqueio_padrao', l.mensagem_bloqueio_padrao
  ) INTO v_llm_config
  FROM public.llm_clinic_config l
  WHERE l.cliente_id = p_cliente_id;

  RETURN json_build_object(
    'cliente', v_cliente,
    'llm_config', v_llm_config
  );
END;
$$;

-- Criar função para sincronizar cliente com llm_clinic_config
CREATE OR REPLACE FUNCTION public.sincronizar_cliente_llm(
  p_cliente_id uuid,
  p_nome_clinica text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_data_minima_agendamento date DEFAULT NULL,
  p_dias_busca_inicial integer DEFAULT NULL,
  p_dias_busca_expandida integer DEFAULT NULL,
  p_mensagem_bloqueio_padrao text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se usuário é admin ou admin_clinica
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'admin_clinica')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- Upsert na llm_clinic_config
  INSERT INTO public.llm_clinic_config (
    cliente_id,
    nome_clinica,
    telefone,
    whatsapp,
    endereco,
    data_minima_agendamento,
    dias_busca_inicial,
    dias_busca_expandida,
    mensagem_bloqueio_padrao
  )
  VALUES (
    p_cliente_id,
    COALESCE(p_nome_clinica, (SELECT nome FROM public.clientes WHERE id = p_cliente_id)),
    p_telefone,
    p_whatsapp,
    p_endereco,
    COALESCE(p_data_minima_agendamento, '2026-01-01'::date),
    COALESCE(p_dias_busca_inicial, 14),
    COALESCE(p_dias_busca_expandida, 45),
    p_mensagem_bloqueio_padrao
  )
  ON CONFLICT (cliente_id) DO UPDATE SET
    nome_clinica = COALESCE(EXCLUDED.nome_clinica, llm_clinic_config.nome_clinica),
    telefone = COALESCE(EXCLUDED.telefone, llm_clinic_config.telefone),
    whatsapp = COALESCE(EXCLUDED.whatsapp, llm_clinic_config.whatsapp),
    endereco = COALESCE(EXCLUDED.endereco, llm_clinic_config.endereco),
    data_minima_agendamento = COALESCE(EXCLUDED.data_minima_agendamento, llm_clinic_config.data_minima_agendamento),
    dias_busca_inicial = COALESCE(EXCLUDED.dias_busca_inicial, llm_clinic_config.dias_busca_inicial),
    dias_busca_expandida = COALESCE(EXCLUDED.dias_busca_expandida, llm_clinic_config.dias_busca_expandida),
    mensagem_bloqueio_padrao = COALESCE(EXCLUDED.mensagem_bloqueio_padrao, llm_clinic_config.mensagem_bloqueio_padrao),
    updated_at = now();

  -- Sincronizar campos de contato com tabela clientes
  UPDATE public.clientes
  SET
    telefone = COALESCE(p_telefone, telefone),
    whatsapp = COALESCE(p_whatsapp, whatsapp),
    endereco = COALESCE(p_endereco, endereco),
    updated_at = now()
  WHERE id = p_cliente_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Atualizar função get_clientes_ativos para incluir novos campos
DROP FUNCTION IF EXISTS public.get_clientes_ativos();

CREATE OR REPLACE FUNCTION public.get_clientes_ativos()
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  whatsapp text,
  endereco text,
  logo_url text,
  ativo boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem listar clientes';
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.nome,
    c.telefone,
    c.whatsapp,
    c.endereco,
    c.logo_url,
    c.ativo,
    c.created_at
  FROM public.clientes c
  WHERE c.ativo = true
  ORDER BY c.nome;
END;
$$;