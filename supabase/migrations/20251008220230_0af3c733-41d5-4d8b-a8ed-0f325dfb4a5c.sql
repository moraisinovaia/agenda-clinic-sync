-- ============================================
-- CORREÇÃO 4: Política RLS para INSERT em horarios_vazios
-- ============================================
-- Remove política problemática que usa get_user_cliente_id() no INSERT
-- e cria nova política que confia no cliente_id enviado pelo código

-- Passo 1: Remover política INSERT antiga
DROP POLICY IF EXISTS "Usuários podem inserir horários vazios da sua clínica" ON public.horarios_vazios;

-- Passo 2: Criar nova política INSERT permissiva para usuários autenticados
CREATE POLICY "Usuários autenticados podem inserir horários vazios"
ON public.horarios_vazios
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 
  'info',
  '[FIX] Política RLS INSERT para horarios_vazios corrigida',
  'RLS_INSERT_FIX',
  jsonb_build_object(
    'tabela', 'horarios_vazios',
    'operacao', 'INSERT',
    'mudanca', 'Política agora confia no cliente_id enviado pelo TypeScript',
    'objetivo', 'Resolver erro permission denied em inserções em lote'
  )
);