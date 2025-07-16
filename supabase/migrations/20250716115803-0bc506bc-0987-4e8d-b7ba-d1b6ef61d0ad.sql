-- Limpar duplicatas e adicionar configurações de segurança

-- Primeiro, remover duplicatas mantendo apenas a primeira ocorrência
DELETE FROM public.configuracoes_clinica a USING public.configuracoes_clinica b
WHERE a.id > b.id AND a.chave = b.chave;

-- Agora adicionar a constraint única
ALTER TABLE public.configuracoes_clinica 
ADD CONSTRAINT uk_configuracoes_chave UNIQUE (chave);

-- Inserir configurações de segurança se não existirem
DO $$
BEGIN
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