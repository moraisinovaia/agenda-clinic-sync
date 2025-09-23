-- FASE 1: MIGRAÇÃO SEM AGENDAMENTOS - Completar outras tabelas primeiro

DO $$
DECLARE
    inovaia_id UUID;
BEGIN
    SELECT id INTO inovaia_id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1;
    
    -- Atualizar todas as tabelas EXCETO agendamentos
    UPDATE public.medicos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.atendimentos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.pacientes SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.profiles SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.bloqueios_agenda SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.fila_espera SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.preparos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
END $$;

-- Definir NOT NULL para todas as tabelas EXCETO agendamentos
ALTER TABLE public.medicos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.atendimentos ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.pacientes ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.bloqueios_agenda ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.fila_espera ALTER COLUMN cliente_id SET NOT NULL;
ALTER TABLE public.preparos ALTER COLUMN cliente_id SET NOT NULL;

-- Criar foreign keys para todas as tabelas EXCETO agendamentos
ALTER TABLE public.medicos ADD CONSTRAINT fk_medicos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.atendimentos ADD CONSTRAINT fk_atendimentos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
ALTER TABLE public.pacientes ADD CONSTRAINT fk_pacientes_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
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

-- Log da migração (parcial)
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Migração multi-clínica parcial: todas tabelas migradas exceto agendamentos (problema com validação de convênios)',
  'MULTI_CLINIC_PARTIAL'
);