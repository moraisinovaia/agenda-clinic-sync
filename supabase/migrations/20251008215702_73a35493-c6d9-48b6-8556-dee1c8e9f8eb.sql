-- ============================================
-- CORREÇÃO 3: Função get_user_cliente_id() com fallback
-- ============================================
-- Esta correção adiciona tratamento para quando auth.uid() retorna NULL
-- durante operações em lote (como inserção de múltiplos horários_vazios)

CREATE OR REPLACE FUNCTION public.get_user_cliente_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_cliente_id uuid;
  v_user_id uuid;
BEGIN
  -- Capturar auth.uid() em variável
  v_user_id := auth.uid();
  
  -- Se não há usuário autenticado, retornar NULL (permite bypass em algumas políticas)
  IF v_user_id IS NULL THEN
    RAISE WARNING 'get_user_cliente_id: auth.uid() retornou NULL - operação sem contexto de autenticação';
    RETURN NULL;
  END IF;
  
  -- Buscar cliente_id do perfil
  SELECT cliente_id INTO v_cliente_id
  FROM public.profiles 
  WHERE user_id = v_user_id 
  LIMIT 1;
  
  -- Se não encontrou o perfil, logar warning
  IF v_cliente_id IS NULL THEN
    RAISE WARNING 'get_user_cliente_id: Perfil não encontrado para user_id=%', v_user_id;
  END IF;
  
  RETURN v_cliente_id;
END;
$function$;

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 
  'info',
  '[FIX] Função get_user_cliente_id() corrigida com fallback para NULL',
  'RLS_FIX',
  jsonb_build_object(
    'funcao', 'get_user_cliente_id',
    'mudanca', 'Adicionado tratamento para auth.uid() NULL',
    'objetivo', 'Permitir inserções em lote de horarios_vazios'
  )
);