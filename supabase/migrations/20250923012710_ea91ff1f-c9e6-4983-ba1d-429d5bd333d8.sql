-- FASE 1: FINALIZAÇÃO - RLS Policies com IF EXISTS

-- Remover policies existentes se houver e recriar com isolamento por cliente

-- Policies para atendimentos
DO $$
BEGIN
    DROP POLICY IF EXISTS "Usuários podem ver atendimentos da sua clínica" ON public.atendimentos;
    DROP POLICY IF EXISTS "Usuários autenticados podem criar atendimentos" ON public.atendimentos;
    DROP POLICY IF EXISTS "Usuários podem criar atendimentos na sua clínica" ON public.atendimentos;
    DROP POLICY IF EXISTS "Usuários autenticados podem atualizar atendimentos da sua clínica" ON public.atendimentos;
    DROP POLICY IF EXISTS "Usuários autenticados podem deletar atendimentos da sua clínica" ON public.atendimentos;

    -- Criar novas policies
    CREATE POLICY "Atendimentos - visualizar da clínica" ON public.atendimentos
    FOR SELECT USING (cliente_id = public.get_user_cliente_id());

    CREATE POLICY "Atendimentos - criar na clínica" ON public.atendimentos
    FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

    CREATE POLICY "Atendimentos - atualizar da clínica" ON public.atendimentos
    FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

    CREATE POLICY "Atendimentos - deletar da clínica" ON public.atendimentos
    FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);
END $$;

-- Policies para pacientes
DO $$
BEGIN
    DROP POLICY IF EXISTS "Usuários podem ver pacientes da sua clínica" ON public.pacientes;
    DROP POLICY IF EXISTS "Usuários podem criar pacientes na sua clínica" ON public.pacientes;
    DROP POLICY IF EXISTS "Usuários podem atualizar pacientes da sua clínica" ON public.pacientes;
    DROP POLICY IF EXISTS "Usuários podem deletar pacientes da sua clínica" ON public.pacientes;

    -- Criar novas policies
    CREATE POLICY "Pacientes - visualizar da clínica" ON public.pacientes
    FOR SELECT USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

    CREATE POLICY "Pacientes - criar na clínica" ON public.pacientes
    FOR INSERT WITH CHECK (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

    CREATE POLICY "Pacientes - atualizar da clínica" ON public.pacientes
    FOR UPDATE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);

    CREATE POLICY "Pacientes - deletar da clínica" ON public.pacientes
    FOR DELETE USING (cliente_id = public.get_user_cliente_id() AND auth.uid() IS NOT NULL);
END $$;

-- Policy temporária para agendamentos (sem isolamento por enquanto)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Política temporária agendamentos - acesso por auth" ON public.agendamentos;
    DROP POLICY IF EXISTS "Usuários autenticados podem ver agendamentos" ON public.agendamentos;
    DROP POLICY IF EXISTS "Usuários autenticados podem criar agendamentos" ON public.agendamentos;
    DROP POLICY IF EXISTS "Usuários autenticados podem atualizar agendamentos" ON public.agendamentos;
    DROP POLICY IF EXISTS "Usuários autenticados podem deletar agendamentos" ON public.agendamentos;

    -- Policy temporária que mantém funcionamento atual
    CREATE POLICY "Agendamentos - acesso temporário" ON public.agendamentos
    FOR ALL USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
END $$;

-- Log final da Fase 1
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'success',
  'FASE 1 MULTI-CLÍNICA IMPLEMENTADA: Estrutura criada, INOVAIA como cliente base, isolamento por cliente_id ativo (agendamentos com policy temporária)',
  'MULTI_CLINIC_PHASE_1_SUCCESS'
);