-- CORREÇÕES CRÍTICAS DE SEGURANÇA PARA PRODUÇÃO

-- 1. Habilitar RLS em todas as tabelas críticas
ALTER TABLE public.agendamentos_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_espera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinica_valores ENABLE ROW LEVEL SECURITY;

-- 2. Criar policies RLS para agendamentos_audit (somente leitura para auditoria)
CREATE POLICY "Usuarios autenticados podem ver auditoria" ON public.agendamentos_audit
FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. Corrigir policies para bloqueios_agenda
DROP POLICY IF EXISTS "bloqueios_agenda_authenticated" ON public.bloqueios_agenda;
CREATE POLICY "Usuarios autenticados podem gerenciar bloqueios" ON public.bloqueios_agenda
FOR ALL USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Corrigir policies para preparos
DROP POLICY IF EXISTS "full_access_preparos" ON public.preparos;
CREATE POLICY "Usuarios autenticados podem gerenciar preparos" ON public.preparos
FOR ALL USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Corrigir policies para fila_espera
DROP POLICY IF EXISTS "full_access_fila_espera" ON public.fila_espera;
CREATE POLICY "Usuarios autenticados podem gerenciar fila_espera" ON public.fila_espera
FOR ALL USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Corrigir funções com search_path seguro
CREATE OR REPLACE FUNCTION public.processar_fila_cancelamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Adicionar constraint para evitar agendamento duplo do mesmo paciente
CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamento_paciente_data_hora 
ON public.agendamentos (paciente_id, data_agendamento, hora_agendamento) 
WHERE status IN ('agendado', 'confirmado');

-- 8. Função para validar limite de agendamentos por médico
CREATE OR REPLACE FUNCTION public.validar_limite_agendamentos_medico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  limite_diario INTEGER := 20; -- Máximo 20 pacientes por médico por dia
  total_agendamentos INTEGER;
BEGIN
  -- Contar agendamentos do médico na data
  SELECT COUNT(*)
  INTO total_agendamentos
  FROM public.agendamentos
  WHERE medico_id = NEW.medico_id
    AND data_agendamento = NEW.data_agendamento
    AND status IN ('agendado', 'confirmado');
  
  -- Verificar se excede o limite
  IF total_agendamentos >= limite_diario THEN
    RAISE EXCEPTION 'Limite de % agendamentos por dia excedido para este médico', limite_diario;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 9. Trigger para validar limite de agendamentos
CREATE TRIGGER trigger_validar_limite_agendamentos
  BEFORE INSERT ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_limite_agendamentos_medico();

-- 10. Função para prevenir agendamento duplo do paciente
CREATE OR REPLACE FUNCTION public.validar_agendamento_duplicado_paciente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  agendamentos_conflito INTEGER;
BEGIN
  -- Verificar se paciente já tem agendamento no mesmo horário
  SELECT COUNT(*)
  INTO agendamentos_conflito
  FROM public.agendamentos
  WHERE paciente_id = NEW.paciente_id
    AND data_agendamento = NEW.data_agendamento
    AND hora_agendamento = NEW.hora_agendamento
    AND status IN ('agendado', 'confirmado')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Se encontrou conflito, impedir
  IF agendamentos_conflito > 0 THEN
    RAISE EXCEPTION 'Paciente já possui agendamento neste horário';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 11. Trigger para validar agendamento duplicado
CREATE TRIGGER trigger_validar_agendamento_duplicado
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_agendamento_duplicado_paciente();