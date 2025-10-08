-- ✅ CORREÇÃO CRÍTICA: Adicionar políticas RLS faltantes para horarios_vazios

-- Política para INSERT (usuários podem inserir horários vazios da sua clínica)
CREATE POLICY "Usuários podem inserir horários vazios da sua clínica"
ON public.horarios_vazios
FOR INSERT
TO authenticated
WITH CHECK (
  cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL
);

-- Política para UPDATE (usuários podem atualizar horários vazios da sua clínica)
CREATE POLICY "Usuários podem atualizar horários vazios da sua clínica"
ON public.horarios_vazios
FOR UPDATE
TO authenticated
USING (
  cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL
)
WITH CHECK (
  cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL
);

-- Log da correção
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 
  'info',
  '[SECURITY] Políticas RLS críticas adicionadas para horarios_vazios',
  'RLS_POLICY_FIX',
  jsonb_build_object(
    'table', 'horarios_vazios',
    'policies_added', jsonb_build_array('INSERT', 'UPDATE'),
    'fix_reason', 'Correção de permission denied ao gerar horários'
  )
);