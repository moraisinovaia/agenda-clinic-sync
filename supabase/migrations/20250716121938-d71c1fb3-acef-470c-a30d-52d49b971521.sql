-- Primeiro, verificar se já existe um perfil para moraisinovaiacloud@gmail.com
-- Se não existir, vamos assumir que o usuário auth já foi criado e inserir o perfil manualmente

-- Inserir perfil como admin se não existir
INSERT INTO public.profiles (user_id, nome, email, role, status, data_aprovacao)
SELECT 
  au.id,
  'Gabriela Morais',
  'moraisinovaiacloud@gmail.com',
  'admin',
  'aprovado',
  now()
FROM auth.users au
WHERE au.email = 'moraisinovaiacloud@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.email = 'moraisinovaiacloud@gmail.com'
);

-- Se já existe, apenas promover a admin
UPDATE public.profiles 
SET 
  role = 'admin',
  status = 'aprovado',
  data_aprovacao = now(),
  nome = 'Gabriela Morais'
WHERE email = 'moraisinovaiacloud@gmail.com';

-- Verificar se temos um admin agora
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = 'moraisinovaiacloud@gmail.com' 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RAISE NOTICE 'Usuário ainda não cadastrado no sistema auth. Complete o cadastro primeiro.';
  ELSE
    RAISE NOTICE 'Gabriela Morais promovida a administradora com sucesso!';
  END IF;
END $$;