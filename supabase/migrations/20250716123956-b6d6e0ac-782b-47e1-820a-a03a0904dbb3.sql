-- Promover Gabriela Lima de Morais a administradora
-- Atualizar o perfil existente se existir, ou inserir se não existir

-- Primeiro, tentar atualizar o perfil existente
UPDATE public.profiles 
SET 
  role = 'admin',
  status = 'aprovado',
  data_aprovacao = now(),
  nome = 'Gabriela Lima de Morais'
WHERE email = 'moraisinovaiacloud@gmail.com'
  OR LOWER(nome) LIKE '%gabriela%morais%';

-- Se não encontrou nenhum registro para atualizar, inserir novo admin
-- (isso só funcionará se já existir um usuário auth correspondente)
INSERT INTO public.profiles (user_id, nome, email, role, status, data_aprovacao)
SELECT 
  au.id,
  'Gabriela Lima de Morais',
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

-- Verificar resultado
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (email = 'moraisinovaiacloud@gmail.com' OR LOWER(nome) LIKE '%gabriela%morais%')
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RAISE NOTICE 'Gabriela Lima de Morais promovida a administradora com sucesso!';
  ELSE
    RAISE NOTICE 'Usuário ainda não encontrado. Verifique se a conta foi criada no sistema auth.';
  END IF;
END $$;