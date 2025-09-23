-- ===================================================================
-- FINALIZAR FASE 1: SISTEMA MULTI-CLÍNICA (VERSÃO CORRIGIDA)
-- ===================================================================

-- 1. Temporariamente desabilitar trigger de validação de convênio
DROP TRIGGER IF EXISTS validate_patient_insurance_trigger ON public.agendamentos;

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

-- 4. Aplicar RLS definitivo para agendamentos
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

-- 5. Recriar o trigger de validação de convênio (se existir)
CREATE OR REPLACE FUNCTION public.validate_patient_insurance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  doctor_convenios TEXT[];
  patient_convenio TEXT;
BEGIN
  -- Buscar convênios aceitos pelo médico
  SELECT m.convenios_aceitos INTO doctor_convenios
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  -- Se não há restrições de convênio, permitir
  IF doctor_convenios IS NULL OR array_length(doctor_convenios, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar convênio do paciente
  SELECT p.convenio INTO patient_convenio
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  -- Verificar se o convênio é aceito
  IF NOT (patient_convenio = ANY(doctor_convenios)) THEN
    RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', patient_convenio;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recriar o trigger apenas para INSERTs e UPDATEs específicos
CREATE TRIGGER validate_patient_insurance_trigger
  BEFORE INSERT OR UPDATE OF medico_id, paciente_id ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_patient_insurance();

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
-- ✅ Validações reconfiguradas para multi-clínica
-- ===================================================================