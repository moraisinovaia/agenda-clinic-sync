-- Criar profile para o usuário teste@exemplo.com vinculado ao IPADO
INSERT INTO public.profiles (
  user_id,
  nome,
  email,
  role,
  status,
  ativo,
  cliente_id,
  username,
  created_at,
  updated_at
) 
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'nome', 'Usuário Teste'),
  au.email,
  'recepcionista',
  'aprovado',
  true,
  c.id,
  COALESCE(au.raw_user_meta_data->>'username', 'teste_user'),
  now(),
  now()
FROM auth.users au
CROSS JOIN clientes c
WHERE au.email = 'teste@exemplo.com' 
AND c.nome = 'IPADO'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.user_id = au.id
);