-- Primeiro, vamos verificar os dados atuais dos médicos Dr. Carlos e Dra. Jeovana
SELECT id, nome, especialidade, convenios_aceitos 
FROM public.medicos 
WHERE nome ILIKE '%carlos%' OR nome ILIKE '%jeovana%';

-- Atualizar Dr. Carlos (Oftalmologista) para incluir "Particular"
UPDATE public.medicos 
SET convenios_aceitos = ARRAY['Particular', 'Unimed Nacional', 'Unimed Intercâmbio', 'Unimed Coparticipação 20%', 'Unimed Coparticipação 40%']
WHERE nome ILIKE '%carlos%' AND especialidade ILIKE '%oftalmo%';

-- Atualizar Dra. Jeovana para incluir todos os tipos de Unimed
UPDATE public.medicos 
SET convenios_aceitos = ARRAY['Particular', 'Unimed Nacional', 'Unimed Intercâmbio', 'Unimed Coparticipação 20%', 'Unimed Coparticipação 40%']
WHERE nome ILIKE '%jeovana%';

-- Verificar se há atendimentos dos médicos que precisam de valores de coparticipação
SELECT a.id, a.nome, a.medico_nome, a.coparticipacao_unimed_20, a.coparticipacao_unimed_40
FROM public.atendimentos a
WHERE a.medico_nome ILIKE '%carlos%' OR a.medico_nome ILIKE '%jeovana%';