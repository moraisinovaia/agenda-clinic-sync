-- Alterar o usuário teste@exemplo.com para admin para poder aprovar outros usuários
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'teste@exemplo.com';