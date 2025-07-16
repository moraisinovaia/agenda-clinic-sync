-- Correção das configurações de segurança
-- Como não há constraint única na chave, vamos inserir apenas se não existir

DO $$
BEGIN
    -- Inserir configurações de segurança se não existirem
    IF NOT EXISTS (SELECT 1 FROM public.configuracoes_clinica WHERE chave = 'security_otp_expiry') THEN
        INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras) 
        VALUES ('security_otp_expiry', '300', 'security', true, '{"description": "OTP expiry time in seconds (5 minutes)"}');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.configuracoes_clinica WHERE chave = 'security_password_policy') THEN
        INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras) 
        VALUES ('security_password_policy', 'enabled', 'security', true, '{"min_length": 8, "require_special": true, "require_numbers": true}');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.configuracoes_clinica WHERE chave = 'security_session_timeout') THEN
        INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras) 
        VALUES ('security_session_timeout', '3600', 'security', true, '{"description": "Session timeout in seconds (1 hour)"}');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.configuracoes_clinica WHERE chave = 'security_max_login_attempts') THEN
        INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras) 
        VALUES ('security_max_login_attempts', '5', 'security', true, '{"description": "Maximum failed login attempts before lockout"}');
    END IF;
END
$$;

-- Adicionar unique constraint na chave para melhor integridade
ALTER TABLE public.configuracoes_clinica 
ADD CONSTRAINT uk_configuracoes_chave UNIQUE (chave);

-- Criar função para melhor segurança na autenticação
CREATE OR REPLACE FUNCTION public.log_authentication_attempt(
    p_user_email text,
    p_success boolean,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Log de tentativas de autenticação para auditoria de segurança
    INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras)
    VALUES (
        'auth_log_' || extract(epoch from now()),
        p_user_email,
        'auth_log',
        true,
        json_build_object(
            'success', p_success,
            'timestamp', now(),
            'ip_address', p_ip_address,
            'user_agent', p_user_agent
        )
    );
    
    -- Limpar logs antigos (manter apenas últimos 30 dias)
    DELETE FROM public.configuracoes_clinica 
    WHERE categoria = 'auth_log' 
      AND created_at < (now() - interval '30 days');
      
EXCEPTION
    WHEN OTHERS THEN
        -- Falhar silenciosamente para não bloquear autenticação
        NULL;
END;
$function$;