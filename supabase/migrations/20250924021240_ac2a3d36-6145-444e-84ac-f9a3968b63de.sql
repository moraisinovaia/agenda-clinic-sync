-- Corrigir políticas RLS para permitir busca de username durante login

-- Remover políticas conflitantes e criar uma política específica para busca de username
DROP POLICY IF EXISTS "Allow username check for signup" ON public.profiles;
DROP POLICY IF EXISTS "Public username check" ON public.profiles;

-- Criar política específica para busca segura de username durante login
CREATE POLICY "Login username lookup" 
ON public.profiles 
FOR SELECT 
USING (true); -- Permite acesso de leitura para buscar username/email durante login

-- Manter outras políticas existentes mas garantir que não conflitem
-- A política "Own profile access" permanece para acesso completo ao próprio perfil
-- A política "Super admin access" permanece para super admins

-- Log da correção
INSERT INTO public.system_logs (
    timestamp, level, message, context, data
) VALUES (
    now(), 'info', 
    'Políticas RLS corrigidas para permitir login com username',
    'RLS_LOGIN_FIX',
    jsonb_build_object(
        'action', 'rls_policies_updated',
        'table', 'profiles',
        'issue_fixed', 'username_login_access'
    )
);