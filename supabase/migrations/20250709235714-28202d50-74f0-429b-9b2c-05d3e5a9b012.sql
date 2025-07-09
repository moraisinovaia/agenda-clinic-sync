-- Criar tabela para bloqueios de agenda
CREATE TABLE public.bloqueios_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medico_id UUID NOT NULL REFERENCES public.medicos(id),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT NOT NULL,
  criado_por TEXT NOT NULL DEFAULT 'recepcionista',
  criado_por_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status VARCHAR(50) NOT NULL DEFAULT 'ativo'
);

-- Enable RLS
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Usuários autenticados podem ver bloqueios" 
ON public.bloqueios_agenda 
FOR SELECT 
USING (true);

CREATE POLICY "Usuários autenticados podem criar bloqueios" 
ON public.bloqueios_agenda 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar bloqueios" 
ON public.bloqueios_agenda 
FOR UPDATE 
USING (true);

CREATE POLICY "Usuários autenticados podem deletar bloqueios" 
ON public.bloqueios_agenda 
FOR DELETE 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_bloqueios_agenda_updated_at
BEFORE UPDATE ON public.bloqueios_agenda
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para processar bloqueio de agenda
CREATE OR REPLACE FUNCTION public.processar_bloqueio_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  agendamento_record RECORD;
BEGIN
  -- Só processa se é um novo bloqueio ativo
  IF TG_OP = 'INSERT' AND NEW.status = 'ativo' THEN
    
    -- Buscar todos os agendamentos afetados pelo bloqueio
    FOR agendamento_record IN
      SELECT a.*, p.nome_completo, p.celular, m.nome as medico_nome, at.nome as atendimento_nome
      FROM public.agendamentos a
      JOIN public.pacientes p ON a.paciente_id = p.id
      JOIN public.medicos m ON a.medico_id = m.id
      JOIN public.atendimentos at ON a.atendimento_id = at.id
      WHERE a.medico_id = NEW.medico_id
        AND a.data_agendamento BETWEEN NEW.data_inicio AND NEW.data_fim
        AND a.status = 'agendado'
    LOOP
      -- Marcar agendamento como cancelado
      UPDATE public.agendamentos 
      SET status = 'cancelado_bloqueio',
          observacoes = COALESCE(observacoes, '') || ' - Cancelado por bloqueio de agenda: ' || NEW.motivo
      WHERE id = agendamento_record.id;
      
      -- Log para auditoria
      RAISE NOTICE 'Agendamento % cancelado por bloqueio para paciente %', 
        agendamento_record.id, agendamento_record.nome_completo;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para processamento automático
CREATE TRIGGER trigger_processar_bloqueio_agenda
AFTER INSERT ON public.bloqueios_agenda
FOR EACH ROW
EXECUTE FUNCTION public.processar_bloqueio_agenda();