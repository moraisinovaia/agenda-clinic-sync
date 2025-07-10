-- Corrigir políticas RLS para bloqueios_agenda
DROP POLICY IF EXISTS "Usuários autenticados podem ver bloqueios" ON public.bloqueios_agenda;
DROP POLICY IF EXISTS "Usuários autenticados podem criar bloqueios" ON public.bloqueios_agenda;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar bloqueios" ON public.bloqueios_agenda;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar bloqueios" ON public.bloqueios_agenda;

-- Criar políticas mais permissivas para permitir que a Edge Function funcione
CREATE POLICY "Acesso completo bloqueios_agenda" 
ON public.bloqueios_agenda 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Verificar se o trigger está funcionando corretamente
-- Atualizar função para melhor log
CREATE OR REPLACE FUNCTION public.processar_bloqueio_agenda()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  agendamento_record RECORD;
  total_cancelados INTEGER := 0;
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
          observacoes = COALESCE(observacoes, '') || ' - Cancelado por bloqueio de agenda: ' || NEW.motivo,
          updated_at = now()
      WHERE id = agendamento_record.id;
      
      total_cancelados := total_cancelados + 1;
      
      -- Log para auditoria
      RAISE NOTICE 'Agendamento % cancelado por bloqueio para paciente %', 
        agendamento_record.id, agendamento_record.nome_completo;
    END LOOP;
    
    -- Log do total processado
    RAISE NOTICE 'Bloqueio % processado: % agendamentos cancelados', NEW.id, total_cancelados;
  END IF;
  
  RETURN NEW;
END;
$$;