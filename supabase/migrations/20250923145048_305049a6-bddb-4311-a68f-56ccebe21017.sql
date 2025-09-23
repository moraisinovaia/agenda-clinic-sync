-- Confirmar email do usuário teste@ipado.com
UPDATE auth.users 
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'teste@ipado.com';