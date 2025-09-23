-- Criar função para inserir cliente IPADO
CREATE OR REPLACE FUNCTION public.criar_cliente_ipado()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se já existe um cliente IPADO
  IF EXISTS (SELECT 1 FROM public.clientes WHERE nome = 'IPADO') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Cliente IPADO já existe'
    );
  END IF;

  -- Inserir o cliente IPADO
  INSERT INTO public.clientes (
    nome,
    ativo,
    configuracoes
  ) VALUES (
    'IPADO',
    true,
    '{"tipo": "clinica", "sistema_origem": "manual"}'::jsonb
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Cliente IPADO criado com sucesso'
  );
END;
$function$