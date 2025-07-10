-- FASE 1: CORREÇÕES CRÍTICAS DE SEGURANÇA E BANCO DE DADOS

-- 1. Corrigir políticas RLS da tabela profiles
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

-- 2. Adicionar constraint único para prevenir agendamentos duplicados
ALTER TABLE public.agendamentos 
ADD CONSTRAINT unique_agendamento_medico_data_hora 
UNIQUE (medico_id, data_agendamento, hora_agendamento);

-- 3. Adicionar constraint para validar status válidos
ALTER TABLE public.agendamentos 
DROP CONSTRAINT IF EXISTS agendamentos_status_check;

ALTER TABLE public.agendamentos 
ADD CONSTRAINT agendamentos_status_check 
CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado', 'cancelado_bloqueio', 'falta'));

-- 4. Adicionar constraint para validar que data de agendamento não seja no passado
-- Usando função ao invés de CHECK constraint para evitar problemas de restore
CREATE OR REPLACE FUNCTION validate_appointment_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Permitir atualizações de status sem validar data
  IF TG_OP = 'UPDATE' AND OLD.data_agendamento = NEW.data_agendamento AND OLD.hora_agendamento = NEW.hora_agendamento THEN
    RETURN NEW;
  END IF;
  
  -- Validar que não é no passado (com tolerância de 1 hora para ajustes)
  IF (NEW.data_agendamento::timestamp + NEW.hora_agendamento::time) < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Não é possível agendar para uma data/hora que já passou';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_appointment_date_trigger
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION validate_appointment_date();

-- 5. Função para validar idade vs médico
CREATE OR REPLACE FUNCTION validate_patient_age_for_doctor()
RETURNS TRIGGER AS $$
DECLARE
  patient_age INTEGER;
  doctor_min_age INTEGER;
  doctor_max_age INTEGER;
BEGIN
  -- Buscar idade do paciente
  SELECT EXTRACT(YEAR FROM AGE(current_date, p.data_nascimento))::INTEGER
  INTO patient_age
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  -- Buscar restrições de idade do médico
  SELECT m.idade_minima, m.idade_maxima
  INTO doctor_min_age, doctor_max_age
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  -- Validar idade mínima
  IF doctor_min_age IS NOT NULL AND patient_age < doctor_min_age THEN
    RAISE EXCEPTION 'Paciente com % anos está abaixo da idade mínima (% anos) para este médico', patient_age, doctor_min_age;
  END IF;
  
  -- Validar idade máxima
  IF doctor_max_age IS NOT NULL AND patient_age > doctor_max_age THEN
    RAISE EXCEPTION 'Paciente com % anos está acima da idade máxima (% anos) para este médico', patient_age, doctor_max_age;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_patient_age_trigger
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION validate_patient_age_for_doctor();

-- 6. Função para validar convênio aceito pelo médico
CREATE OR REPLACE FUNCTION validate_patient_insurance()
RETURNS TRIGGER AS $$
DECLARE
  patient_insurance TEXT;
  doctor_insurances TEXT[];
BEGIN
  -- Buscar convênio do paciente
  SELECT p.convenio
  INTO patient_insurance
  FROM public.pacientes p
  WHERE p.id = NEW.paciente_id;
  
  -- Buscar convênios aceitos pelo médico
  SELECT m.convenios_aceitos
  INTO doctor_insurances
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  -- Validar se o convênio é aceito (se há lista de convênios definida)
  IF doctor_insurances IS NOT NULL AND array_length(doctor_insurances, 1) > 0 THEN
    IF NOT (patient_insurance = ANY(doctor_insurances)) THEN
      RAISE EXCEPTION 'Convênio "%" não é aceito por este médico', patient_insurance;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_insurance_trigger
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION validate_patient_insurance();

-- 7. Criar tabela de auditoria para agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_agent TEXT,
  ip_address INET
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.agendamentos_audit ENABLE ROW LEVEL SECURITY;

-- Política para auditoria (apenas leitura para usuários autenticados)
CREATE POLICY "audit_select_authenticated" ON public.agendamentos_audit
FOR SELECT TO authenticated
USING (true);

-- 8. Trigger de auditoria para agendamentos
CREATE OR REPLACE FUNCTION audit_agendamentos()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, new_data, changed_by)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, old_data, new_data, changed_by)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.agendamentos_audit (agendamento_id, action, old_data, changed_by)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agendamentos_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION audit_agendamentos();

-- 9. Adicionar índices para performance
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

-- 10. Validar que médico está ativo
CREATE OR REPLACE FUNCTION validate_doctor_active()
RETURNS TRIGGER AS $$
DECLARE
  doctor_active BOOLEAN;
BEGIN
  SELECT m.ativo
  INTO doctor_active
  FROM public.medicos m
  WHERE m.id = NEW.medico_id;
  
  IF NOT doctor_active THEN
    RAISE EXCEPTION 'Não é possível agendar com médico inativo';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_doctor_active_trigger
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION validate_doctor_active();

-- 11. Atualizar constraint da tabela bloqueios_agenda para incluir service_role
ALTER TABLE public.bloqueios_agenda DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloqueios_agenda_authenticated" ON public.bloqueios_agenda
FOR ALL TO authenticated, service_role
USING (true)
WITH CHECK (true);