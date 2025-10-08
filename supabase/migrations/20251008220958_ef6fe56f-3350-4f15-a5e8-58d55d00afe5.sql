-- ============================================
-- CORREÇÃO FINAL: Políticas RLS não-conflitantes para horarios_vazios
-- ============================================
-- Remove política FOR ALL conflitante e cria políticas específicas por operação

-- Passo 1: Remover política FOR ALL que causa conflito
DROP POLICY IF EXISTS "Usuários gerenciam horários vazios da sua clínica" ON public.horarios_vazios;

-- Passo 2: Criar políticas específicas para UPDATE
CREATE POLICY "Usuários atualizam horários da sua clínica"
ON public.horarios_vazios
FOR UPDATE
TO authenticated
USING ((cliente_id = get_user_cliente_id()) AND (auth.uid() IS NOT NULL))
WITH CHECK ((cliente_id = get_user_cliente_id()) AND (auth.uid() IS NOT NULL));

-- Passo 3: Criar políticas específicas para DELETE
CREATE POLICY "Usuários deletam horários da sua clínica"
ON public.horarios_vazios
FOR DELETE
TO authenticated
USING ((cliente_id = get_user_cliente_id()) AND (auth.uid() IS NOT NULL));

-- Políticas finais após esta migração:
-- ✅ INSERT: "Usuários autenticados podem inserir horários vazios" (permissiva, confia no cliente_id do código)
-- ✅ SELECT: "Usuários visualizam horários vazios da sua clínica" (filtra por get_user_cliente_id())
-- ✅ UPDATE: "Usuários atualizam horários da sua clínica" (filtra por get_user_cliente_id())
-- ✅ DELETE: "Usuários deletam horários da sua clínica" (filtra por get_user_cliente_id())
-- ✅ ALL: "Super admin pode gerenciar todos horários vazios" (acesso total para super admin)

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 
  'info',
  '[FIX FINAL] Políticas RLS horarios_vazios reorganizadas sem conflitos',
  'RLS_FINAL_FIX',
  jsonb_build_object(
    'tabela', 'horarios_vazios',
    'mudanca', 'Removida política FOR ALL conflitante, criadas políticas específicas UPDATE/DELETE',
    'objetivo', 'Eliminar conflito que causava permission denied no INSERT'
  )
);