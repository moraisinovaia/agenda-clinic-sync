-- CORREÇÃO DE AGENDAMENTOS DUPLICADOS E IMPLEMENTAÇÃO DE VALIDAÇÕES

-- 1. Primeiro, identificar e manter apenas o agendamento mais recente de cada duplicata
WITH duplicados AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY medico_id, data_agendamento, hora_agendamento 
           ORDER BY created_at DESC
         ) as rn
  FROM public.agendamentos
)
DELETE FROM public.agendamentos 
WHERE id IN (
  SELECT id FROM duplicados WHERE rn > 1
);

-- 2. Corrigir políticas RLS da tabela profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

-- Criar políticas RLS mais robustas para profiles
CREATE POLICY "profiles_select_authenticated" ON public.profiles
FOR SELECT TO authenticated
USING (true); -- Usuários autenticados podem ver todos os profiles (necessário para auditoria)

CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_delete_own" ON public.profiles
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Política para service_role (para triggers)
CREATE POLICY "profiles_service_role" ON public.profiles
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 3. Agora adicionar constraint único para prevenir novos agendamentos duplicados
ALTER TABLE public.agendamentos 
ADD CONSTRAINT unique_agendamento_medico_data_hora 
UNIQUE (medico_id, data_agendamento, hora_agendamento);

-- 4. Adicionar constraint para validar status válidos
ALTER TABLE public.agendamentos 
DROP CONSTRAINT IF EXISTS agendamentos_status_check;

ALTER TABLE public.agendamentos 
ADD CONSTRAINT agendamentos_status_check 
CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado', 'cancelado_bloqueio', 'falta'));

-- 5. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_medico_data 
ON public.agendamentos (medico_id, data_agendamento);

CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente 
ON public.agendamentos (paciente_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_status 
ON public.agendamentos (status);

CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora 
ON public.agendamentos (data_agendamento, hora_agendamento);

CREATE INDEX IF NOT EXISTS idx_pacientes_nascimento 
ON public.pacientes (data_nascimento);

CREATE INDEX IF NOT EXISTS idx_pacientes_convenio 
ON public.pacientes (convenio);

-- 6. Corrigir políticas da tabela bloqueios_agenda
DROP POLICY IF EXISTS "bloqueios_agenda_policy" ON public.bloqueios_agenda;

CREATE POLICY "bloqueios_agenda_authenticated" ON public.bloqueios_agenda
FOR ALL TO authenticated, service_role
USING (true)
WITH CHECK (true);