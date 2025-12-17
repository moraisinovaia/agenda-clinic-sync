-- =====================================================
-- FASE 3: MIGRAÇÃO DOS DADOS IPADO PARA CONFIGURAÇÃO LLM
-- =====================================================

-- 1. CONFIGURAÇÃO GERAL DA CLÍNICA IPADO
INSERT INTO public.llm_clinic_config (
  cliente_id, nome_clinica, telefone, whatsapp, endereco,
  data_minima_agendamento, mensagem_bloqueio_padrao,
  dias_busca_inicial, dias_busca_expandida, ativo
) VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'IPADO - Clínica de Especialidades',
  '(87) 3866-4050',
  '(87) 3866-4050',
  NULL,
  '2026-01-01',
  'Agendamentos disponíveis a partir de janeiro/2026. Para datas anteriores, entre em contato pelo telefone: (87) 3866-4050',
  14, 45, true
) ON CONFLICT (cliente_id) DO UPDATE SET
  nome_clinica = EXCLUDED.nome_clinica,
  telefone = EXCLUDED.telefone,
  data_minima_agendamento = EXCLUDED.data_minima_agendamento,
  mensagem_bloqueio_padrao = EXCLUDED.mensagem_bloqueio_padrao;

-- 2. BUSINESS RULES - DR. MARCELO D'CARLI
INSERT INTO public.business_rules (cliente_id, medico_id, config, ativo, version)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  '1e110923-50df-46ff-a57a-29d88e372900',
  '{"nome":"DR. MARCELO D''CARLI","tipo_agendamento":"ordem_chegada","servicos":{"Consulta Cardiológica":{"permite_online":true,"tipo":"ordem_chegada","dias_semana":[1,2,3,4,5],"periodos":{"manha":{"inicio":"07:00","fim":"12:00","limite":9,"atendimento_inicio":"07:45","distribuicao_fichas":"07:00 às 09:30"},"tarde":{"inicio":"13:00","fim":"17:00","limite":9,"dias_especificos":[1,3],"atendimento_inicio":"13:45","distribuicao_fichas":"13:00 às 15:00"}}},"Teste Ergométrico":{"permite_online":true,"tipo":"ordem_chegada","dias_semana":[2,3,4],"periodos":{"manha":{"inicio":"07:00","fim":"12:00","limite":9,"dias_especificos":[3],"atendimento_inicio":"07:45","distribuicao_fichas":"07:00 às 09:30"},"tarde":{"inicio":"13:00","fim":"17:00","limite":9,"dias_especificos":[2,4],"atendimento_inicio":"13:45","distribuicao_fichas":"13:00 às 15:00"}}},"ECG":{"permite_online":false,"mensagem":"O ECG de rotina não precisa de agendamento. Compareça à clínica de segunda a sexta (8h-10h) ou quarta à tarde (14h-15h), por ordem de chegada."}}}'::jsonb,
  true, 1
) ON CONFLICT (medico_id, cliente_id) DO UPDATE SET config = EXCLUDED.config, version = business_rules.version + 1;

-- 3. BUSINESS RULES - DRA. ADRIANA CARLA DE SENA
INSERT INTO public.business_rules (cliente_id, medico_id, config, ativo, version)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  '32d30887-b876-4502-bf04-e55d7fb55b50',
  '{"nome":"DRA. ADRIANA CARLA DE SENA","tipo_agendamento":"ordem_chegada","idade_minima":18,"servicos":{"Consulta Endocrinológica":{"permite_online":true,"tipo":"ordem_chegada","dias_semana":[1,2,3,4,5],"periodos":{"manha":{"inicio":"08:00","fim":"10:00","limite":9,"atendimento_inicio":"08:45","distribuicao_fichas":"08:00 às 10:00"},"tarde":{"inicio":"13:00","fim":"15:00","limite":9,"dias_especificos":[2,3],"atendimento_inicio":"14:45","distribuicao_fichas":"13:00 às 15:00"}}}}}'::jsonb,
  true, 1
) ON CONFLICT (medico_id, cliente_id) DO UPDATE SET config = EXCLUDED.config, version = business_rules.version + 1;

-- 4. BUSINESS RULES - DR. PEDRO FRANCISCO
INSERT INTO public.business_rules (cliente_id, medico_id, config, ativo, version)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  '66e9310d-34cd-4005-8937-74e87125dc03',
  '{"nome":"DR. PEDRO FRANCISCO","tipo_agendamento":"ordem_chegada","servicos":{"Consulta":{"permite_online":true,"tipo":"ordem_chegada","dias_semana":[2,4],"periodos":{"manha":{"inicio":"09:30","fim":"10:00","limite":4,"atendimento_inicio":null,"distribuicao_fichas":"09:30 às 10:00","observacao":"O Dr. começa a atender quando termina os exames"}},"convenios_aceitos":["UNIMED NACIONAL","UNIMED REGIONAL","UNIMED 40%","UNIMED 20%","UNIMED INTERCAMBIO","MEDPREV"]},"Retorno":{"permite_online":true,"tipo":"ordem_chegada","dias_semana":[2,4],"periodos":{"manha":{"inicio":"09:30","fim":"10:00","limite":4,"atendimento_inicio":null,"distribuicao_fichas":"09:30 às 10:00","observacao":"O Dr. começa a atender quando termina os exames"}},"convenios_aceitos":["UNIMED NACIONAL","UNIMED REGIONAL","UNIMED 40%","UNIMED 20%","UNIMED INTERCAMBIO","MEDPREV"]}}}'::jsonb,
  true, 1
) ON CONFLICT (medico_id, cliente_id) DO UPDATE SET config = EXCLUDED.config, version = business_rules.version + 1;

-- 5. BUSINESS RULES - DR. ALESSANDRO DIAS
INSERT INTO public.business_rules (cliente_id, medico_id, config, ativo, version)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'c192e08e-e216-4c22-99bf-b5992ce05e17',
  '{"nome":"DR. ALESSANDRO DIAS","tipo_agendamento":"ordem_chegada","servicos":{"Ecocardiograma":{"permite_online":true,"tipo":"ordem_chegada","dias_semana":[1],"periodos":{"manha":{"inicio":"08:00","fim":"09:00","limite":10,"atendimento_inicio":"08:00","distribuicao_fichas":"08:00 às 09:00"}},"convenios_aceitos":["UNIMED NACIONAL","UNIMED REGIONAL","UNIMED 40%","UNIMED 20%","UNIMED INTERCAMBIO","MEDPREV"]},"Consulta Cardiológica":{"permite_online":false,"mensagem":"Consultas devem ser agendadas por ligação: (87) 3866-4050"}}}'::jsonb,
  true, 1
) ON CONFLICT (medico_id, cliente_id) DO UPDATE SET config = EXCLUDED.config, version = business_rules.version + 1;

-- 6. MENSAGENS PERSONALIZADAS
INSERT INTO public.llm_mensagens (cliente_id, medico_id, tipo, mensagem, ativo) VALUES
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '1e110923-50df-46ff-a57a-29d88e372900', 'bloqueio_agenda', 'Para tentar encaixe antes é apenas com a secretária Jeniffe ou Luh no WhatsApp: 87981126744', true),
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '32d30887-b876-4502-bf04-e55d7fb55b50', 'bloqueio_agenda', 'O(a) paciente pode tentar um encaixe com a Dra. Adriana por ligação normal nesse mesmo número (87) 3866-4050 (não atendemos ligação via whatsapp), de segunda a sexta-feira, às 10:00h, ou nas terças e quartas-feiras, às 14:30h', true),
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '32d30887-b876-4502-bf04-e55d7fb55b50', 'confirmacao_agendamento', 'A Dra. Adriana atende por ordem de chegada. O(a) paciente deve comparecer no horário indicado para retirar a ficha.', true),
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', NULL, 'data_bloqueada', 'Agendamentos disponíveis a partir de janeiro/2026. Para datas anteriores, entre em contato pelo telefone: (87) 3866-4050', true),
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', NULL, 'sem_disponibilidade', 'Não há vagas disponíveis antes de janeiro/2026. Para consultas anteriores a esta data, ligue: (87) 3866-4050', true),
('2bfb98b5-ae41-4f96-8ba7-acc797c22054', NULL, 'agendamentos_antigos', 'Não encontrei agendamentos no sistema novo. Se sua consulta é anterior a janeiro/2026, os dados estão no sistema anterior. Entre em contato: (87) 3866-4050', true);