-- Promover Gabriela Morais (moraisinovaiacloud@gmail.com) a administradora
UPDATE public.profiles 
SET 
  role = 'admin',
  status = 'aprovado',
  data_aprovacao = now()
WHERE email = 'moraisinovaiacloud@gmail.com';

-- Verificar se a atualização foi bem-sucedida
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = 'moraisinovaiacloud@gmail.com' 
    AND role = 'admin' 
    AND status = 'aprovado'
  ) THEN
    RAISE EXCEPTION 'Falha ao promover usuário a administrador - verifique se o usuário existe';
  END IF;
END $$;