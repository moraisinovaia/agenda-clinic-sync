-- Criar tabela para fila de espera
CREATE TABLE public.fila_espera (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL,
  medico_id UUID NOT NULL,
  atendimento_id UUID NOT NULL,
  data_preferida DATE NOT NULL,
  periodo_preferido VARCHAR(20) CHECK (periodo_preferido IN ('manha', 'tarde', 'qualquer')) DEFAULT 'qualquer',
  observacoes TEXT,
  status VARCHAR(20) CHECK (status IN ('aguardando', 'notificado', 'agendado', 'cancelado')) DEFAULT 'aguardando',
  prioridade INTEGER DEFAULT 1,
  data_limite DATE,
  tentativas_contato INTEGER DEFAULT 0,
  ultimo_contato TIMESTAMP WITH TIME ZONE,
  agendamento_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_fila_paciente FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id),
  CONSTRAINT fk_fila_medico FOREIGN KEY (medico_id) REFERENCES public.medicos(id),
  CONSTRAINT fk_fila_atendimento FOREIGN KEY (atendimento_id) REFERENCES public.atendimentos(id),
  CONSTRAINT fk_fila_agendamento FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id)
);

-- Habilitar RLS
ALTER TABLE public.fila_espera ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para acesso público (mesmo padrão das outras tabelas)
CREATE POLICY "Public access to fila_espera" 
ON public.fila_espera 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fila_espera_updated_at
BEFORE UPDATE ON public.fila_espera
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_fila_espera_medico_data ON public.fila_espera(medico_id, data_preferida);
CREATE INDEX idx_fila_espera_status ON public.fila_espera(status);
CREATE INDEX idx_fila_espera_prioridade ON public.fila_espera(prioridade DESC, created_at);

-- Criar tabela para log de notificações da fila
CREATE TABLE public.fila_notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fila_id UUID NOT NULL,
  horario_disponivel TIMESTAMP WITH TIME ZONE NOT NULL,
  data_agendamento DATE NOT NULL,
  hora_agendamento TIME NOT NULL,
  canal_notificacao VARCHAR(20) CHECK (canal_notificacao IN ('whatsapp', 'sms', 'email')) DEFAULT 'whatsapp',
  status_envio VARCHAR(20) CHECK (status_envio IN ('enviado', 'erro', 'pendente')) DEFAULT 'pendente',
  tempo_limite TIMESTAMP WITH TIME ZONE NOT NULL,
  resposta_paciente VARCHAR(20) CHECK (resposta_paciente IN ('aceito', 'recusado', 'sem_resposta')) DEFAULT 'sem_resposta',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_notif_fila FOREIGN KEY (fila_id) REFERENCES public.fila_espera(id) ON DELETE CASCADE
);

-- Habilitar RLS
ALTER TABLE public.fila_notificacoes ENABLE ROW LEVEL SECURITY;

-- Política RLS para acesso público
CREATE POLICY "Public access to fila_notificacoes" 
ON public.fila_notificacoes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Índices para notificações
CREATE INDEX idx_fila_notif_status ON public.fila_notificacoes(status_envio);
CREATE INDEX idx_fila_notif_tempo_limite ON public.fila_notificacoes(tempo_limite);

-- Função para processar fila de espera quando há cancelamento
CREATE OR REPLACE FUNCTION public.processar_fila_cancelamento()
RETURNS TRIGGER AS $$
DECLARE
  fila_record RECORD;
BEGIN
  -- Só processa se o agendamento foi cancelado
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    
    -- Buscar próximo da fila para este médico e data
    SELECT fe.*, p.nome_completo, p.celular, m.nome as medico_nome, a.nome as atendimento_nome
    INTO fila_record
    FROM public.fila_espera fe
    JOIN public.pacientes p ON fe.paciente_id = p.id
    JOIN public.medicos m ON fe.medico_id = m.id
    JOIN public.atendimentos a ON fe.atendimento_id = a.id
    WHERE fe.medico_id = NEW.medico_id
      AND fe.data_preferida <= NEW.data_agendamento
      AND fe.status = 'aguardando'
      AND (fe.data_limite IS NULL OR fe.data_limite >= NEW.data_agendamento)
    ORDER BY fe.prioridade DESC, fe.created_at ASC
    LIMIT 1;
    
    -- Se encontrou alguém na fila, criar notificação
    IF FOUND THEN
      -- Inserir notificação com tempo limite de 2 horas
      INSERT INTO public.fila_notificacoes (
        fila_id,
        horario_disponivel,
        data_agendamento,
        hora_agendamento,
        tempo_limite
      ) VALUES (
        fila_record.id,
        now(),
        NEW.data_agendamento,
        NEW.hora_agendamento,
        now() + interval '2 hours'
      );
      
      -- Atualizar status da fila para notificado
      UPDATE public.fila_espera 
      SET status = 'notificado', 
          ultimo_contato = now(),
          tentativas_contato = tentativas_contato + 1
      WHERE id = fila_record.id;
      
      -- Log para auditoria
      RAISE NOTICE 'Fila processada: paciente % notificado para vaga de % às %', 
        fila_record.nome_completo, NEW.data_agendamento, NEW.hora_agendamento;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar fila automaticamente em cancelamentos
CREATE TRIGGER trigger_processar_fila_cancelamento
AFTER UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.processar_fila_cancelamento();