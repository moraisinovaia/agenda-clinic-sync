-- FASE 1: FINALIZAÇÃO - RLS Policies (sem agendamentos por enquanto)

-- Atualizar policies principais para isolamento por cliente

-- Atualizar policies da tabela atendimentos
DROP POLICY IF EXISTS "Usuários podem ver atendimentos da sua clínica" ON public.atendimentos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar atendimentos da sua clínica" ON public.atendimentos;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar atendimentos da sua clínica" ON public.atendimentos;

CREATE POLICY "Usuários podem ver atendimentos da sua clínica" ON public.atendimentos
FOR SELECT USING (cliente_id = public.get_user_cliente_id());

CREATE POLICY "Usuários podem criar atendimentos na sua clínica" ON public.atendimentos
FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar atendimentos da sua clínica" ON public.atendimentos
FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar atendimentos da sua clínica" ON public.atendimentos
FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Atualizar policies da tabela pacientes
DROP POLICY IF EXISTS "Usuários podem ver pacientes da sua clínica" ON public.pacientes;
DROP POLICY IF EXISTS "Usuários podem criar pacientes na sua clínica" ON public.pacientes;
DROP POLICY IF EXISTS "Usuários podem atualizar pacientes da sua clínica" ON public.pacientes;
DROP POLICY IF EXISTS "Usuários podem deletar pacientes da sua clínica" ON public.pacientes;

CREATE POLICY "Usuários podem ver pacientes da sua clínica" ON public.pacientes
FOR SELECT USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem criar pacientes na sua clínica" ON public.pacientes
FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar pacientes da sua clínica" ON public.pacientes
FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem deletar pacientes da sua clínica" ON public.pacientes
FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Nota sobre agendamentos - criar policy temporária que permite acesso enquanto não migrados
CREATE POLICY "Política temporária agendamentos - acesso por auth" ON public.agendamentos
FOR ALL USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Log da migração (parcial mas funcional)
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'FASE 1 PARCIALMENTE COMPLETA: Multi-clínica ativo para médicos, atendimentos, pacientes, profiles. Agendamentos pendente devido a validação de convênios.',
  'MULTI_CLINIC_PHASE_1_PARTIAL_SUCCESS'
);