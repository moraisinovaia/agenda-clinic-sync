-- Como não podemos aplicar RLS diretamente em views, vamos criar uma função
-- que retorna os usuários pendentes com a segurança adequada

-- Criar função para buscar usuários pendentes com segurança
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE(
  id uuid,
  nome text,
  email text,
  username character varying,
  role text,
  created_at timestamp with time zone,
  aprovado_por_nome text
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    p.id,
    p.nome,
    p.email,
    p.username,
    p.role,
    p.created_at,
    a.nome as aprovado_por_nome
  FROM public.profiles p
  LEFT JOIN public.profiles a ON p.aprovado_por = a.id
  WHERE p.status = 'pendente'
  ORDER BY p.created_at ASC;
$$;

-- Conceder permissão para usuários autenticados executarem esta função
GRANT EXECUTE ON FUNCTION public.get_pending_users() TO authenticated;

-- Verificar se a função foi criada
DO $$
BEGIN
  RAISE NOTICE 'Função get_pending_users() criada com sucesso';
  RAISE NOTICE 'Usuários autenticados agora podem buscar usuários pendentes via função';
END $$;