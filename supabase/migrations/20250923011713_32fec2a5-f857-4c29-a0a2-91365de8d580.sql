-- FASE 1: PREPARAÇÃO MULTI-CLÍNICA
-- Etapa 1: Criar tabela clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  logo_url TEXT,
  configuracoes JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS para tabela clientes (apenas super-admins)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins podem gerenciar clientes" ON public.clientes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin' 
    AND status = 'aprovado'
  )
);

-- Inserir INOVAIA como primeiro cliente
INSERT INTO public.clientes (nome, configuracoes) 
VALUES ('INOVAIA', '{"tipo": "clinica_gastroenterologia", "sistema_origem": true}');

-- Etapa 2: Adicionar cliente_id nas tabelas principais
-- Obter o ID da INOVAIA para usar como padrão
DO $$
DECLARE
    inovaia_id UUID;
BEGIN
    SELECT id INTO inovaia_id FROM public.clientes WHERE nome = 'INOVAIA' LIMIT 1;
    
    -- Adicionar cliente_id nas tabelas core
    ALTER TABLE public.medicos ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    ALTER TABLE public.atendimentos ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    ALTER TABLE public.pacientes ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    ALTER TABLE public.agendamentos ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    ALTER TABLE public.profiles ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    ALTER TABLE public.bloqueios_agenda ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    ALTER TABLE public.fila_espera ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    ALTER TABLE public.preparos ADD COLUMN cliente_id UUID DEFAULT inovaia_id;
    
    -- Atualizar dados existentes com o cliente_id da INOVAIA
    UPDATE public.medicos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.atendimentos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.pacientes SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.agendamentos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.profiles SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.bloqueios_agenda SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.fila_espera SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    UPDATE public.preparos SET cliente_id = inovaia_id WHERE cliente_id IS NULL;
    
    -- Definir NOT NULL após migração
    ALTER TABLE public.medicos ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE public.atendimentos ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE public.pacientes ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE public.agendamentos ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE public.profiles ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE public.bloqueios_agenda ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE public.fila_espera ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE public.preparos ALTER COLUMN cliente_id SET NOT NULL;
    
    -- Criar foreign keys
    ALTER TABLE public.medicos ADD CONSTRAINT fk_medicos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    ALTER TABLE public.atendimentos ADD CONSTRAINT fk_atendimentos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    ALTER TABLE public.pacientes ADD CONSTRAINT fk_pacientes_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    ALTER TABLE public.agendamentos ADD CONSTRAINT fk_agendamentos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    ALTER TABLE public.bloqueios_agenda ADD CONSTRAINT fk_bloqueios_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    ALTER TABLE public.fila_espera ADD CONSTRAINT fk_fila_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    ALTER TABLE public.preparos ADD CONSTRAINT fk_preparos_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
END $$;

-- Etapa 3: Criar função helper para obter cliente do usuário
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

-- Etapa 4: Atualizar RLS policies para incluir isolamento por cliente

-- Atualizar policies da tabela medicos
DROP POLICY IF EXISTS "Public access to medicos" ON public.medicos;
CREATE POLICY "Usuários podem ver médicos da sua clínica" ON public.medicos
FOR SELECT USING (cliente_id = public.get_user_cliente_id());

CREATE POLICY "Usuários autenticados podem criar médicos" ON public.medicos
FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar médicos da sua clínica" ON public.medicos
FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar médicos da sua clínica" ON public.medicos
FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Atualizar policies da tabela atendimentos
DROP POLICY IF EXISTS "Public access to atendimentos" ON public.atendimentos;
CREATE POLICY "Usuários podem ver atendimentos da sua clínica" ON public.atendimentos
FOR SELECT USING (cliente_id = public.get_user_cliente_id());

CREATE POLICY "Usuários autenticados podem criar atendimentos" ON public.atendimentos
FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar atendimentos da sua clínica" ON public.atendimentos
FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar atendimentos da sua clínica" ON public.atendimentos
FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Atualizar policies da tabela pacientes
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar pacientes" ON public.pacientes;
CREATE POLICY "Usuários podem ver pacientes da sua clínica" ON public.pacientes
FOR SELECT USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem criar pacientes na sua clínica" ON public.pacientes
FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar pacientes da sua clínica" ON public.pacientes
FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar pacientes da sua clínica" ON public.pacientes
FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Atualizar policies da tabela agendamentos
DROP POLICY IF EXISTS "Usuários autenticados podem ver agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar agendamentos" ON public.agendamentos;

CREATE POLICY "Usuários podem ver agendamentos da sua clínica" ON public.agendamentos
FOR SELECT USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem criar agendamentos na sua clínica" ON public.agendamentos
FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar agendamentos da sua clínica" ON public.agendamentos
FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar agendamentos da sua clínica" ON public.agendamentos
FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Atualizar policies da tabela bloqueios_agenda
DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar bloqueios" ON public.bloqueios_agenda;
CREATE POLICY "Usuários podem gerenciar bloqueios da sua clínica" ON public.bloqueios_agenda
FOR ALL USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL)
WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Atualizar policies da tabela fila_espera
DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar fila_espera" ON public.fila_espera;
CREATE POLICY "Usuários podem gerenciar fila da sua clínica" ON public.fila_espera
FOR ALL USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL)
WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Atualizar policies da tabela preparos
DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar preparos" ON public.preparos;
CREATE POLICY "Usuários podem gerenciar preparos da sua clínica" ON public.preparos
FOR ALL USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL)
WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at na tabela clientes
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Log da migração
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Fase 1 da migração multi-clínica concluída: Estrutura criada, dados migrados para INOVAIA',
  'MULTI_CLINIC_PHASE_1'
);