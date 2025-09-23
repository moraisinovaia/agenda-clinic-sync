-- FASE 1: CONTINUAÇÃO - Desabilitar triggers temporariamente para migração

-- Desabilitar trigger de validação de convênios temporariamente
DROP TRIGGER IF EXISTS validate_patient_insurance_trigger ON public.agendamentos;

-- Atualizar todos os dados existentes com o cliente_id da INOVAIA
UPDATE public.medicos 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

UPDATE public.atendimentos 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

UPDATE public.pacientes 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

UPDATE public.agendamentos 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

UPDATE public.profiles 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

UPDATE public.bloqueios_agenda 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

UPDATE public.fila_espera 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

UPDATE public.preparos 
SET cliente_id = (SELECT id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1) 
WHERE cliente_id IS NULL;

-- Definir NOT NULL após migração dos dados
ALTER TABLE public.medicos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.atendimentos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.pacientes ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.agendamentos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.bloqueios_agenda ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.fila_espera ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.preparos ALTER COLUMN cliente_id SET NOT NULL;

-- Criar foreign keys para garantir integridade referencial
ALTER TABLE public.medicos ADD CONSTRAINT fk_medicos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.atendimentos ADD CONSTRAINT fk_atendimentos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.pacientes ADD CONSTRAINT fk_pacientes_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.agendamentos ADD CONSTRAINT fk_agendamentos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.bloqueios_agenda ADD CONSTRAINT fk_bloqueios_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.fila_espera ADD CONSTRAINT fk_fila_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.preparos ADD CONSTRAINT fk_preparos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);

-- Criar função helper para obter cliente do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_cliente_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT cliente_id 
    FROM public.profiles 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Trigger para atualizar updated_at na tabela clientes
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Recriar trigger de validação de convênios (se existia)
CREATE TRIGGER validate_patient_insurance_trigger
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_patient_age_for_doctor();

-- Log da migração
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Estrutura multi-clínica criada: dados migrados para INOVAIA, foreign keys estabelecidas',
  'MULTI_CLINIC_STRUCTURE'
);