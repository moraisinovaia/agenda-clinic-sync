-- Alterar o usuário teste@exemplo.com para recepcionista
UPDATE public.profiles 
SET role = 'recepcionista'
WHERE email = 'teste@exemplo.com';