-- Criar função para inserir cliente IPADO
CREATE OR REPLACE FUNCTION public.criar_cliente_ipado()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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

-- Executar a função para criar o cliente
SELECT public.criar_cliente_ipado();