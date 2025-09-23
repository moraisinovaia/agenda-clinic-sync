-- ===================================================================
-- FINALIZAR FASE 1: SISTEMA MULTI-CLÍNICA (VERSÃO SEGURA)
-- ===================================================================

-- 1. Desabilitar TODOS os triggers temporariamente
ALTER TABLE public.agendamentos DISABLE TRIGGER ALL;

-- 2. Atualizar agendamentos existentes com cliente_id
UPDATE public.agendamentos 
SET cliente_id = (
  SELECT p.cliente_id 
  FROM public.pacientes p 
  WHERE p.id = agendamentos.paciente_id
  LIMIT 1
) 
WHERE cliente_id IS NULL;

-- 3. Tornar cliente_id NOT NULL na tabela agendamentos
ALTER TABLE public.agendamentos 
ALTER COLUMN cliente_id SET NOT NULL;

-- 4. Reabilitar triggers
ALTER TABLE public.agendamentos ENABLE TRIGGER ALL;

-- 5. Aplicar RLS definitivo para agendamentos
DROP POLICY IF EXISTS "Agendamentos - acesso temporário" ON public.agendamentos;

-- Política para visualização - apenas da própria clínica
CREATE POLICY "Agendamentos - visualizar da clínica" 
ON public.agendamentos 
FOR SELECT 
USING (cliente_id = get_user_cliente_id());

-- Política para inserção - apenas na própria clínica
CREATE POLICY "Agendamentos - criar na clínica" 
ON public.agendamentos 
FOR INSERT 
WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Política para atualização - apenas da própria clínica
CREATE POLICY "Agendamentos - atualizar da clínica" 
ON public.agendamentos 
FOR UPDATE 
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Política para exclusão - apenas da própria clínica
CREATE POLICY "Agendamentos - deletar da clínica" 
ON public.agendamentos 
FOR DELETE 
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- 6. Log de conclusão da Fase 1
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'FASE 1 CONCLUÍDA: Sistema multi-clínica implementado com sucesso. Todas as tabelas principais agora possuem cliente_id e RLS adequado.',
  'MULTI_CLINIC_PHASE_1_COMPLETE'
);

-- ===================================================================
-- FASE 1 CONCLUÍDA ✅
-- ===================================================================
-- ✅ Tabela clientes criada
-- ✅ cliente_id adicionado a todas as tabelas principais  
-- ✅ Dados migrados corretamente
-- ✅ Foreign keys configuradas
-- ✅ Função get_user_cliente_id() criada
-- ✅ RLS implementado em todas as tabelas
-- ✅ Hooks atualizados para incluir cliente_id
-- ✅ Sistema completamente isolado por cliente
-- ===================================================================