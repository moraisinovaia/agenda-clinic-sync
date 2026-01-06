-- =====================================================
-- REGRAS DE COLONOSCOPIA - ENDOGASTRO
-- =====================================================

-- 1. Atualizar Dr. Sydney Ribeiro - Adicionar regras de colonoscopia
UPDATE public.medicos
SET observacoes = 'IDADES MÍNIMAS: Consulta 12 anos | EDA 13 anos | Colonoscopia 15 anos. CONVÊNIOS: Unimed, Bradesco, Postal, Mineração, FACHESF (exceto nº 43), FUSEX, Camed, Assefaz, Codevasf, Cassic, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular. PAGAMENTO PARTICULAR: Espécie, PIX ou 2x cartão. PROCEDIMENTOS: Colonoscopia, Musectomia, Ligadura, Polipectomia, Dilatação, Balão Intragástrico. AGENDA: Segunda (Consultas Convênio 15h/16h) | Terça/Quarta (EDA 7h + Colono 9:30-12h) | Sexta (EDA 7h + Consulta Particular 11h/12h). COLONOSCOPIA +60 ANOS: Sempre às 09:30, pré-agendamento obrigatório, enfermeira faz triagem. TAXAS: Soro R$80 | Polipectomia Particular R$600 | Vale Saúde R$500. Paciente internado: pedir prontuário para avaliar aptidão.'
WHERE id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b';

UPDATE public.business_rules
SET config = config || jsonb_build_object(
  'colonoscopia_regras', jsonb_build_object(
    'pre_agendamento', true,
    'triagem_60_anos', jsonb_build_object(
      'ativo', true,
      'horario', '09:30',
      'mensagem', 'Pacientes acima de 60 anos: deixamos pré-agendamento e a enfermeira entrará em contato para triagem.'
    ),
    'nao_faz_crianca', true,
    'paciente_internado', 'Solicitar prontuário de internação para o médico avaliar aptidão antes de confirmar.',
    'taxas', jsonb_build_object(
      'soro', 80.00,
      'polipectomia_particular', 600.00,
      'polipectomia_vale_saude', 500.00
    ),
    'pedir_guia_carteirinha', true,
    'mensagem_triagem', 'Para colonoscopia, precisamos do contato do paciente. A enfermeira ligará para fazer uma triagem antes de confirmar o exame.'
  ),
  'regras_grupos', jsonb_build_object(
    'primeiro_grupo', '30 minutos antes para fazer ficha',
    'demais_grupos', '15 minutos antes'
  ),
  'preparo_tarde', 'Para colonoscopia e endoscopia à tarde, passar preparo da tarde.'
)
WHERE medico_id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b';

-- 2. Atualizar Dra. Lara Eline Menezes - Colonoscopia 18 a 65 anos
UPDATE public.medicos
SET 
  idade_minima = 18,
  observacoes = 'GASTRO E HEPATO - A MÉDICA DÁ NOTA FISCAL. Convênios: Bradesco, Mineração, FACHESF (exceto nº 43), FUSEX, Postal, Assefaz, Codevasf, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular, Agenda Vale, Medprev. Pagamento particular: R$500 (espécie/PIX). COLONOSCOPIA: APENAS 18 a 65 ANOS. Menores de 18: entrar em contato com a clínica. TAXAS: Soro R$80 | Polipectomia Particular R$600 | Vale Saúde R$500. Paciente internado: pedir prontuário. Agenda: Segunda (consultas manhã), Quarta (consultas 14:30), Quinta (consultas tarde), Sexta (particular 11h + colono 10h). EDA: Quinta/Sexta/Sábado 08:00 (8 pac).'
WHERE id = '3dd16059-102a-4626-a2ac-2517f0e5c195';

UPDATE public.business_rules
SET config = config || jsonb_build_object(
  'colonoscopia_regras', jsonb_build_object(
    'idade_minima', 18,
    'idade_maxima', 65,
    'pre_agendamento', true,
    'nao_faz_crianca', true,
    'menores_18_contato_clinica', true,
    'paciente_internado', 'Solicitar prontuário de internação para o médico avaliar aptidão.',
    'taxas', jsonb_build_object(
      'soro', 80.00,
      'polipectomia_particular', 600.00,
      'polipectomia_vale_saude', 500.00
    ),
    'pedir_guia_carteirinha', true,
    'mensagem', 'A Dra. Lara realiza colonoscopia apenas em pacientes de 18 a 65 anos. Menores de 18 anos devem entrar em contato com a clínica.'
  ),
  'regras_grupos', jsonb_build_object(
    'primeiro_grupo', '30 minutos antes para fazer ficha',
    'demais_grupos', '15 minutos antes'
  ),
  'preparo_tarde', 'Para colonoscopia e endoscopia à tarde, passar preparo da tarde.'
)
WHERE medico_id = '3dd16059-102a-4626-a2ac-2517f0e5c195';

-- 3. Atualizar Dra. Juliana Gama - Colonoscopia sexta 09:00, 1 paciente, 18+, triagem +59
UPDATE public.medicos
SET 
  idade_minima = 18,
  observacoes = 'GASTRO E HEPATO - Convênios: Bradesco, Mineração, FACHESF (exceto nº 43), FUSEX, Postal, Assefaz, Codevasf, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular, Agenda Vale, Medprev. Pagamento particular: R$500 (espécie/PIX). COLONOSCOPIA: NÃO FAZ PELO MEDPREV. Apenas 18+ anos. Sexta 09:00 (1 paciente). +59 anos: pré-agendamento + triagem enfermeira. TAXAS: Soro R$80 | Polipectomia Particular R$600 | Vale Saúde R$500. Agenda: Segunda e Quinta - EDA 08:00 (4 pac), Consulta 11:00-12:00 (5 pac). Paciente internado: pedir prontuário.'
WHERE id = 'efc2ec87-21dd-4e10-b327-50d83df7daac';

UPDATE public.business_rules
SET config = config || jsonb_build_object(
  'colonoscopia_regras', jsonb_build_object(
    'idade_minima', 18,
    'pre_agendamento', true,
    'nao_faz_crianca', true,
    'menores_18_contato_clinica', true,
    'triagem_59_anos', jsonb_build_object(
      'ativo', true,
      'mensagem', 'Pacientes acima de 59 anos: deixamos pré-agendamento e a enfermeira entrará em contato para triagem.'
    ),
    'dias', ARRAY[5],
    'horario', '09:00',
    'limite', 1,
    'nao_faz_medprev', true,
    'paciente_internado', 'Solicitar prontuário de internação para o médico avaliar aptidão.',
    'taxas', jsonb_build_object(
      'soro', 80.00,
      'polipectomia_particular', 600.00,
      'polipectomia_vale_saude', 500.00
    ),
    'pedir_guia_carteirinha', true,
    'mensagem', 'A Dra. Juliana realiza colonoscopia às sextas-feiras às 09:00 (1 paciente). Apenas pacientes a partir de 18 anos. Acima de 59 anos requer triagem prévia com enfermeira.'
  ),
  'regras_grupos', jsonb_build_object(
    'primeiro_grupo', '30 minutos antes para fazer ficha',
    'demais_grupos', '15 minutos antes'
  ),
  'preparo_tarde', 'Para colonoscopia e endoscopia à tarde, passar preparo da tarde.'
)
WHERE medico_id = 'efc2ec87-21dd-4e10-b327-50d83df7daac';

-- 4. Atualizar Dr. Carlos Philliph - 1º grupo 13:00 para 14:00, dilatação do olho
UPDATE public.medicos
SET observacoes = 'OFTALMOLOGIA - Primeiro grupo 14:00: chegar às 13:00 (1h antes) para fazer ficha e dilatar o olho. Demais grupos: 15 minutos antes do horário. Terça/Quinta: consultas + mapeamento 8 pac (4pac 14h + 4pac 15h).'
WHERE id = '3e3489cf-9da8-408a-89c1-6cef5c950297';

UPDATE public.business_rules
SET config = config || jsonb_build_object(
  'regras_grupos', jsonb_build_object(
    'primeiro_grupo_14h', jsonb_build_object(
      'chegada', '13:00',
      'motivo', 'Fazer ficha e dilatar o olho',
      'antecedencia', '1 hora antes'
    ),
    'demais_grupos', '15 minutos antes'
  ),
  'mensagens', jsonb_build_object(
    'primeiro_grupo', 'Para o primeiro grupo às 14h, chegue às 13h para fazer a ficha e dilatar o olho.',
    'demais_grupos', 'Para os demais horários, chegue 15 minutos antes.'
  )
)
WHERE medico_id = '3e3489cf-9da8-408a-89c1-6cef5c950297';

-- 5. Criar atendimento de Polipectomia para os médicos gastro se não existir
INSERT INTO public.atendimentos (medico_id, cliente_id, nome, tipo, valor_particular, ativo, observacoes)
SELECT 
  '5617c20f-5f3d-4e1f-924c-e624a6b8852b', 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'Taxa de Polipectomia Colonoscopia',
  'procedimento',
  600.00,
  true,
  'Taxa adicional. Vale Saúde: R$500. Particular: R$600.'
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b' 
  AND nome ILIKE '%polipectomia%colonoscopia%'
);

INSERT INTO public.atendimentos (medico_id, cliente_id, nome, tipo, valor_particular, ativo, observacoes)
SELECT 
  '5617c20f-5f3d-4e1f-924c-e624a6b8852b', 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'Taxa de Soro',
  'procedimento',
  80.00,
  true,
  'Taxa adicional para colonoscopia e endoscopia.'
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b' 
  AND nome ILIKE '%taxa%soro%'
);