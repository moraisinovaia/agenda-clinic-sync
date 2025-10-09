-- Migrar usuários do cliente IPADO para INOVAIA
DO $$
DECLARE
  v_inovaia_id UUID;
  v_ipado_id UUID;
BEGIN
  -- Buscar IDs dos clientes
  SELECT id INTO v_inovaia_id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1;
  SELECT id INTO v_ipado_id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1;
  
  IF v_inovaia_id IS NOT NULL AND v_ipado_id IS NOT NULL THEN
    -- Migrar todos os perfis de IPADO para INOVAIA
    UPDATE public.profiles
    SET cliente_id = v_inovaia_id
    WHERE cliente_id = v_ipado_id;
    
    -- Log da migração
    INSERT INTO public.system_logs (
      timestamp, level, message, context, data
    ) VALUES (
      now(), 'info',
      '[MIGRATION] Usuários migrados do cliente IPADO para INOVAIA',
      'CLIENT_MIGRATION',
      jsonb_build_object(
        'from_client_id', v_ipado_id,
        'to_client_id', v_inovaia_id,
        'cliente_from', 'IPADO',
        'cliente_to', 'INOVAIA'
      )
    );
    
    -- Desativar cliente IPADO
    UPDATE public.clientes
    SET ativo = false
    WHERE id = v_ipado_id;
  END IF;
END $$;