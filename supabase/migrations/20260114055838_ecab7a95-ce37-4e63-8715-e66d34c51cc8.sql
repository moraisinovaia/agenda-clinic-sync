
-- Migration: Corrigir enviar_whatsapp_fallback (todas as sobrecargas)
-- Remove credenciais hardcoded

-- Dropar todas as versões da função
DROP FUNCTION IF EXISTS public.enviar_whatsapp_fallback(text, text);
DROP FUNCTION IF EXISTS public.enviar_whatsapp_fallback(uuid);

-- Recriar versão segura (com uuid)
CREATE OR REPLACE FUNCTION public.enviar_whatsapp_fallback(p_agendamento_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY FIX: Removido fallback com credenciais hardcoded
  -- O envio de WhatsApp deve ser feito via Edge Functions que têm acesso seguro às secrets
  RETURN json_build_object(
    'success', false, 
    'error', 'Função depreciada: use a Edge Function de WhatsApp',
    'deprecated', true,
    'agendamento_id', p_agendamento_id
  );
END;
$$;

COMMENT ON FUNCTION public.enviar_whatsapp_fallback(uuid) IS 
'DEPRECATED: Esta função foi desativada por motivos de segurança. Use a Edge Function whatsapp-availability para envio de mensagens.';

-- Recriar versão com texto (para compatibilidade)
CREATE OR REPLACE FUNCTION public.enviar_whatsapp_fallback(p_celular text, p_mensagem text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY FIX: Removido fallback com credenciais hardcoded
  RETURN json_build_object(
    'success', false, 
    'error', 'Função depreciada: use a Edge Function de WhatsApp',
    'deprecated', true
  );
END;
$$;

COMMENT ON FUNCTION public.enviar_whatsapp_fallback(text, text) IS 
'DEPRECATED: Esta função foi desativada por motivos de segurança. Use a Edge Function whatsapp-availability para envio de mensagens.';
