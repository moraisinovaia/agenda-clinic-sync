
-- Renomear campos para maior clareza sobre coparticipação Unimed
-- Tabela atendimentos
ALTER TABLE public.atendimentos 
RENAME COLUMN coparticipacao_20 TO coparticipacao_unimed_20;

ALTER TABLE public.atendimentos 
RENAME COLUMN coparticipacao_40 TO coparticipacao_unimed_40;

-- Tabela clinica_valores
ALTER TABLE public.clinica_valores 
RENAME COLUMN valor_20_pct TO valor_unimed_coparticipacao_20;

ALTER TABLE public.clinica_valores 
RENAME COLUMN valor_40_pct TO valor_unimed_coparticipacao_40;

-- Tabela valores_procedimentos
ALTER TABLE public.valores_procedimentos 
RENAME COLUMN valor_20_pct TO valor_unimed_coparticipacao_20;

ALTER TABLE public.valores_procedimentos 
RENAME COLUMN valor_40_pct TO valor_unimed_coparticipacao_40;

-- Adicionar comentários aos campos para documentação
COMMENT ON COLUMN public.atendimentos.coparticipacao_unimed_20 IS 'Valor de coparticipação de 20% específico para convênio Unimed';
COMMENT ON COLUMN public.atendimentos.coparticipacao_unimed_40 IS 'Valor de coparticipação de 40% específico para convênio Unimed';

COMMENT ON COLUMN public.clinica_valores.valor_unimed_coparticipacao_20 IS 'Valor do procedimento com coparticipação de 20% para Unimed';
COMMENT ON COLUMN public.clinica_valores.valor_unimed_coparticipacao_40 IS 'Valor do procedimento with coparticipação de 40% para Unimed';

COMMENT ON COLUMN public.valores_procedimentos.valor_unimed_coparticipacao_20 IS 'Valor do procedimento com coparticipação de 20% para Unimed';
COMMENT ON COLUMN public.valores_procedimentos.valor_unimed_coparticipacao_40 IS 'Valor do procedimento com coparticipação de 40% para Unimed';

-- Atualizar convênios nos médicos para padronizar nomenclatura
UPDATE public.medicos SET convenios_aceitos = array_replace(convenios_aceitos, 'Unimed 20%', 'Unimed Coparticipação 20%')
WHERE 'Unimed 20%' = ANY(convenios_aceitos);

UPDATE public.medicos SET convenios_aceitos = array_replace(convenios_aceitos, 'Unimed 40%', 'Unimed Coparticipação 40%')
WHERE 'Unimed 40%' = ANY(convenios_aceitos);

-- Atualizar convênios nos pacientes para padronizar nomenclatura
UPDATE public.pacientes SET convenio = 'Unimed Coparticipação 20%' 
WHERE convenio = 'Unimed 20%';

UPDATE public.pacientes SET convenio = 'Unimed Coparticipação 40%' 
WHERE convenio = 'Unimed 40%';

-- Atualizar convênios nos agendamentos para manter consistência
UPDATE public.agendamentos SET convenio = 'Unimed Coparticipação 20%' 
WHERE convenio = 'Unimed 20%';

UPDATE public.agendamentos SET convenio = 'Unimed Coparticipação 40%' 
WHERE convenio = 'Unimed 40%';
