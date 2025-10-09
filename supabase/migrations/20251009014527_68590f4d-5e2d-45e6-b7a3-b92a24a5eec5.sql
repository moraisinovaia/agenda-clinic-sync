-- Corrigir username do usuário específico com o valor correto do metadata
UPDATE public.profiles p
SET username = u.raw_user_meta_data->>'username', updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
AND p.email = 'lss190787@gmail.com';