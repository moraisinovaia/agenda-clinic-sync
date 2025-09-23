-- Criar tabelas específicas para o sistema IPADO
-- Isso garante completa separação dos dados entre clientes

-- Tabela de médicos da IPADO
CREATE TABLE public.ipado_medicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome CHARACTER VARYING NOT NULL,
  especialidade CHARACTER VARYING NOT NULL,
  convenios_aceitos TEXT[],
  idade_minima INTEGER DEFAULT 0,
  idade_maxima INTEGER,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  horarios JSONB,
  convenios_restricoes JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Tabela de atendimentos da IPADO
CREATE TABLE public.ipado_atendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome CHARACTER VARYING NOT NULL,
  tipo CHARACTER VARYING NOT NULL,
  medico_id UUID REFERENCES public.ipado_medicos(id),
  medico_nome CHARACTER VARYING,
  codigo CHARACTER VARYING,
  valor_particular NUMERIC,
  coparticipacao_unimed_20 NUMERIC,
  coparticipacao_unimed_40 NUMERIC,
  forma_pagamento CHARACTER VARYING,
  restricoes TEXT,
  observacoes TEXT,
  horarios JSONB,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Tabela de pacientes da IPADO
CREATE TABLE public.ipado_pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo CHARACTER VARYING NOT NULL,
  data_nascimento DATE NOT NULL,
  convenio CHARACTER VARYING NOT NULL,
  telefone CHARACTER VARYING,
  celular CHARACTER VARYING DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de agendamentos da IPADO
CREATE TABLE public.ipado_agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.ipado_pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.ipado_medicos(id),
  atendimento_id UUID NOT NULL REFERENCES public.ipado_atendimentos(id),
  data_agendamento DATE NOT NULL,
  hora_agendamento TIME WITHOUT TIME ZONE NOT NULL,
  convenio CHARACTER VARYING,
  status CHARACTER VARYING NOT NULL DEFAULT 'agendado',
  observacoes TEXT,
  criado_por TEXT NOT NULL DEFAULT 'recepcionista',
  criado_por_user_id UUID,
  confirmado_por TEXT,
  confirmado_por_user_id UUID,
  confirmado_em TIMESTAMP WITH TIME ZONE,
  cancelado_por TEXT,
  cancelado_por_user_id UUID,
  cancelado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de bloqueios de agenda da IPADO
CREATE TABLE public.ipado_bloqueios_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.ipado_medicos(id),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT NOT NULL,
  status CHARACTER VARYING NOT NULL DEFAULT 'ativo',
  criado_por TEXT NOT NULL DEFAULT 'recepcionista',
  criado_por_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de fila de espera da IPADO
CREATE TABLE public.ipado_fila_espera (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.ipado_pacientes(id),
  medico_id UUID NOT NULL REFERENCES public.ipado_medicos(id),
  atendimento_id UUID NOT NULL REFERENCES public.ipado_atendimentos(id),
  data_preferida DATE NOT NULL,
  data_limite DATE,
  periodo_preferido CHARACTER VARYING DEFAULT 'qualquer',
  prioridade INTEGER DEFAULT 1,
  status CHARACTER VARYING DEFAULT 'aguardando',
  observacoes TEXT,
  agendamento_id UUID,
  ultimo_contato TIMESTAMP WITH TIME ZONE,
  tentativas_contato INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de preparos da IPADO
CREATE TABLE public.ipado_preparos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome CHARACTER VARYING NOT NULL,
  exame CHARACTER VARYING NOT NULL,
  jejum_horas INTEGER,
  dias_suspensao INTEGER,
  medicacao_suspender TEXT,
  restricoes_alimentares TEXT,
  observacoes_especiais TEXT,
  itens_levar TEXT,
  instrucoes JSONB,
  valor_particular NUMERIC,
  valor_convenio NUMERIC,
  forma_pagamento CHARACTER VARYING,
  observacoes_valor TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Habilitar RLS em todas as tabelas da IPADO
ALTER TABLE public.ipado_medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipado_atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipado_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipado_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipado_bloqueios_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipado_fila_espera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipado_preparos ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS que permitem acesso apenas a usuários da IPADO
CREATE POLICY "IPADO users can access ipado_medicos" ON public.ipado_medicos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
);

CREATE POLICY "IPADO users can access ipado_atendimentos" ON public.ipado_atendimentos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
);

CREATE POLICY "IPADO users can access ipado_pacientes" ON public.ipado_pacientes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
);

CREATE POLICY "IPADO users can access ipado_agendamentos" ON public.ipado_agendamentos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
);

CREATE POLICY "IPADO users can access ipado_bloqueios_agenda" ON public.ipado_bloqueios_agenda
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
);

CREATE POLICY "IPADO users can access ipado_fila_espera" ON public.ipado_fila_espera
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
);

CREATE POLICY "IPADO users can access ipado_preparos" ON public.ipado_preparos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    JOIN public.clientes c ON p.cliente_id = c.id 
    WHERE p.user_id = auth.uid() 
    AND c.nome = 'IPADO' 
    AND p.status = 'aprovado'
  )
);

-- Migrar dados existentes da IPADO das tabelas gerais para as tabelas específicas
DO $$
DECLARE
  ipado_cliente_id UUID;
BEGIN
  -- Buscar ID do cliente IPADO
  SELECT id INTO ipado_cliente_id FROM public.clientes WHERE nome = 'IPADO';
  
  IF ipado_cliente_id IS NOT NULL THEN
    -- Migrar médicos
    INSERT INTO public.ipado_medicos (
      id, nome, especialidade, convenios_aceitos, idade_minima, idade_maxima, 
      ativo, observacoes, horarios, convenios_restricoes, created_at
    )
    SELECT 
      id, nome, especialidade, convenios_aceitos, idade_minima, idade_maxima,
      ativo, observacoes, horarios, convenios_restricoes, created_at
    FROM public.medicos 
    WHERE cliente_id = ipado_cliente_id;
    
    -- Migrar atendimentos
    INSERT INTO public.ipado_atendimentos (
      id, nome, tipo, medico_id, medico_nome, codigo, valor_particular,
      coparticipacao_unimed_20, coparticipacao_unimed_40, forma_pagamento,
      restricoes, observacoes, horarios, ativo, created_at
    )
    SELECT 
      id, nome, tipo, medico_id, medico_nome, codigo, valor_particular,
      coparticipacao_unimed_20, coparticipacao_unimed_40, forma_pagamento,
      restricoes, observacoes, horarios, ativo, created_at
    FROM public.atendimentos 
    WHERE cliente_id = ipado_cliente_id;
    
    -- Migrar pacientes
    INSERT INTO public.ipado_pacientes (
      id, nome_completo, data_nascimento, convenio, telefone, celular, created_at, updated_at
    )
    SELECT 
      id, nome_completo, data_nascimento, convenio, telefone, celular, created_at, updated_at
    FROM public.pacientes 
    WHERE cliente_id = ipado_cliente_id;
    
    -- Migrar agendamentos
    INSERT INTO public.ipado_agendamentos (
      id, paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, status, observacoes, criado_por, criado_por_user_id,
      confirmado_por, confirmado_por_user_id, confirmado_em,
      cancelado_por, cancelado_por_user_id, cancelado_em, created_at, updated_at
    )
    SELECT 
      id, paciente_id, medico_id, atendimento_id, data_agendamento, hora_agendamento,
      convenio, status, observacoes, criado_por, criado_por_user_id,
      confirmado_por, confirmado_por_user_id, confirmado_em,
      cancelado_por, cancelado_por_user_id, cancelado_em, created_at, updated_at
    FROM public.agendamentos 
    WHERE cliente_id = ipado_cliente_id;
    
    -- Migrar bloqueios de agenda
    INSERT INTO public.ipado_bloqueios_agenda (
      id, medico_id, data_inicio, data_fim, motivo, status,
      criado_por, criado_por_user_id, created_at, updated_at
    )
    SELECT 
      id, medico_id, data_inicio, data_fim, motivo, status,
      criado_por, criado_por_user_id, created_at, updated_at
    FROM public.bloqueios_agenda 
    WHERE cliente_id = ipado_cliente_id;
    
    -- Migrar fila de espera
    INSERT INTO public.ipado_fila_espera (
      id, paciente_id, medico_id, atendimento_id, data_preferida, data_limite,
      periodo_preferido, prioridade, status, observacoes, agendamento_id,
      ultimo_contato, tentativas_contato, created_at, updated_at
    )
    SELECT 
      id, paciente_id, medico_id, atendimento_id, data_preferida, data_limite,
      periodo_preferido, prioridade, status, observacoes, agendamento_id,
      ultimo_contato, tentativas_contato, created_at, updated_at
    FROM public.fila_espera 
    WHERE cliente_id = ipado_cliente_id;
    
    -- Migrar preparos
    INSERT INTO public.ipado_preparos (
      id, nome, exame, jejum_horas, dias_suspensao, medicacao_suspender,
      restricoes_alimentares, observacoes_especiais, itens_levar, instrucoes,
      valor_particular, valor_convenio, forma_pagamento, observacoes_valor, created_at
    )
    SELECT 
      id, nome, exame, jejum_horas, dias_suspensao, medicacao_suspender,
      restricoes_alimentares, observacoes_especiais, itens_levar, instrucoes,
      valor_particular, valor_convenio, forma_pagamento, observacoes_valor, created_at
    FROM public.preparos 
    WHERE cliente_id = ipado_cliente_id;
    
    RAISE NOTICE 'Migração dos dados da IPADO concluída com sucesso';
  END IF;
END $$;

-- Criar triggers para manter sincronização do nome do médico
CREATE OR REPLACE FUNCTION public.sync_ipado_medico_nome_atendimentos()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.medico_id IS DISTINCT FROM NEW.medico_id) THEN
    IF NEW.medico_id IS NOT NULL THEN
      SELECT nome INTO NEW.medico_nome 
      FROM public.ipado_medicos 
      WHERE id = NEW.medico_id;
    ELSE
      NEW.medico_nome = NULL;
    END IF;
  END IF;
  
  IF TG_OP = 'INSERT' AND NEW.medico_id IS NOT NULL THEN
    SELECT nome INTO NEW.medico_nome 
    FROM public.ipado_medicos 
    WHERE id = NEW.medico_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_ipado_atendimentos_when_medico_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.ipado_atendimentos 
  SET medico_nome = NEW.nome 
  WHERE medico_id = NEW.id;
  
  RETURN NEW;
END;
$function$;

-- Criar triggers
CREATE TRIGGER sync_ipado_medico_nome_trigger
  BEFORE INSERT OR UPDATE ON public.ipado_atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_ipado_medico_nome_atendimentos();

CREATE TRIGGER sync_ipado_medico_nome_on_update_trigger
  AFTER UPDATE ON public.ipado_medicos
  FOR EACH ROW EXECUTE FUNCTION public.sync_ipado_atendimentos_when_medico_changes();

-- Criar trigger para updated_at
CREATE TRIGGER update_ipado_pacientes_updated_at
  BEFORE UPDATE ON public.ipado_pacientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ipado_agendamentos_updated_at
  BEFORE UPDATE ON public.ipado_agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ipado_bloqueios_updated_at
  BEFORE UPDATE ON public.ipado_bloqueios_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ipado_fila_updated_at
  BEFORE UPDATE ON public.ipado_fila_espera
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();