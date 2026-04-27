-- ===================================================================
-- Adiciona flag is_agenda_virtual na tabela medicos
-- Agendas virtuais (MAPA, MRPA, Teste Ergométrico) não devem entrar
-- no fuzzy match normal de médico — só são acessíveis via buscarAgendaDedicada()
-- ===================================================================

ALTER TABLE public.medicos
  ADD COLUMN IF NOT EXISTS is_agenda_virtual BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.medicos.is_agenda_virtual IS
  'Indica agendas virtuais dedicadas a serviços específicos (MAPA, MRPA, Teste Ergométrico). '
  'Excluídas do fuzzy match de médico; acessíveis apenas via buscarAgendaDedicada().';

-- Marcar agendas virtuais existentes (padrão de nome: Serviço + " - Dr. ")
UPDATE public.medicos
SET is_agenda_virtual = true
WHERE nome ILIKE 'MAPA%'
   OR nome ILIKE 'MRPA%'
   OR nome ILIKE 'Teste Ergométrico%'
   OR nome ILIKE 'Teste Ergometrico%';
