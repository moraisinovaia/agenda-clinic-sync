-- Correção 3: Revisar e corrigir as views sem Security Definer 
-- e corrigir inserção sem updated_at

-- Adicionar configurações de segurança para OTP e senhas
-- Inserir configurações de segurança recomendadas

INSERT INTO public.configuracoes_clinica (chave, valor, categoria, ativo, dados_extras) 
VALUES 
    ('security_otp_expiry', '300', 'security', true, '{"description": "OTP expiry time in seconds (5 minutes)"}'),
    ('security_password_policy', 'enabled', 'security', true, '{"min_length": 8, "require_special": true, "require_numbers": true}'),
    ('security_session_timeout', '3600', 'security', true, '{"description": "Session timeout in seconds (1 hour)"}'),
    ('security_max_login_attempts', '5', 'security', true, '{"description": "Maximum failed login attempts before lockout"}')
ON CONFLICT (chave) DO UPDATE SET
    valor = EXCLUDED.valor,
    dados_extras = EXCLUDED.dados_extras;