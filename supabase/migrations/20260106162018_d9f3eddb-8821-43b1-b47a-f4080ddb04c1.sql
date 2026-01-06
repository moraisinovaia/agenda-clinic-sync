
-- =====================================================
-- CONFIGURAÇÃO COMPLETA: Dr. Fábio Drubi (Neurologista)
-- Médico ID: 477006ad-d1e2-47f8-940a-231f873def96
-- Cliente ID: 39e120b4-5fb7-4d6f-9f91-a598a5bbd253
-- =====================================================

-- 1. INSERIR ATENDIMENTOS
-- Consulta Neurológica
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'Consulta Neurológica', 'consulta', 400.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'Consulta Neurológica'
);

-- EEG Simples
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'EEG Simples', 'exame', 120.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'EEG Simples'
);

-- EEG com Mapeamento
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'EEG com Mapeamento', 'exame', 180.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'EEG com Mapeamento'
);

-- ENMG Paralisia Facial
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'ENMG Paralisia Facial', 'exame', 340.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'ENMG Paralisia Facial'
);

-- ENMG 2 Membros (MMII ou MMSS)
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'ENMG 2 Membros (MMII ou MMSS)', 'exame', 615.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'ENMG 2 Membros (MMII ou MMSS)'
);

-- ENMG 4 Membros (MMII + MMSS)
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'ENMG 4 Membros (MMII + MMSS)', 'exame', 1230.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'ENMG 4 Membros (MMII + MMSS)'
);

-- 2. ATUALIZAR DADOS DO MÉDICO
UPDATE medicos
SET 
  idade_minima = 8,
  observacoes = 'CONSULTA NEUROLÓGICA:
- Convênios: Particular, Medprev, Agenda Vale
- Idade mín: 13 anos | Valor: R$400 (espécie/PIX)
- Terça e Quinta: 07 pac (13:00, 14:00, 15:00)
- Chegar 30min antes (1º grupo), 15min antes (demais)
- Limite chegada: 15:30

EEG (Eletroencefalograma):
- Convênios: Particular, Medprev, Agenda Vale, Unimed 0210 (NÃO intercâmbio)
- Idade mín: 8 anos
- Restrições: Paciente agitado NÃO faz, SEM sedação, SEM vigília, SEM ferimento na cabeça
- Valores: Simples R$120 | c/ Map R$180 (PIX/espécie)
- Terça e Sábado: 05 pac (08:00, 08:30, 09:00, 09:30)
- Chegar 30min antes (1º), 15min antes (demais)

ENMG (Eletroneuromiografia):
- Convênios: Unimed só 0210, HGU (guias autorizadas), Medprev, Agenda Vale, Med Saúde, Sertão Saúde, pac Dr.Nivo Melo
- Idade mín: 15 anos | Trazer guia autorizada com validade
- Valores: Paralisia R$340 | 2 membros R$615 | 4 membros R$1.230 (PIX/espécie)
- Resultados: 4-5 dias úteis

AGENDA ENMG:
- Quarta manhã: 14m + 4m Med Saúde (07:30-10:00)
- Quarta tarde: 10m + 4m Sertão + 2m Dr.Nivo (13:00-15:30)
- Sexta manhã: 20m (07:30-10:00)
- Sexta tarde: 14m + 2m Dr.Nivo (13:00-15:30)
- Chegada: 15min antes | 4 membros por hora'
WHERE id = '477006ad-d1e2-47f8-940a-231f873def96';

-- 3. ATUALIZAR BUSINESS RULES
UPDATE business_rules
SET config = jsonb_build_object(
  'idade_minima', 8,
  'idades_por_servico', jsonb_build_object(
    'consulta', 13,
    'eeg', 8,
    'enmg', 15
  ),
  'convenios_por_servico', jsonb_build_object(
    'consulta', jsonb_build_array('PARTICULAR', 'MEDPREV', 'AGENDA VALE'),
    'eeg', jsonb_build_array('PARTICULAR', 'MEDPREV', 'AGENDA VALE', 'UNIMED 0210'),
    'enmg', jsonb_build_array('UNIMED 0210', 'HGU', 'MEDPREV', 'AGENDA VALE', 'MED SAÚDE', 'SERTÃO SAÚDE', 'PAC DR.NIVO MELO')
  ),
  'restricoes', jsonb_build_object(
    'unimed', 'Apenas carteirinha iniciando com 0210. NÃO atende Unimed Intercâmbio.',
    'hgu', 'Guias devem vir autorizadas e com validade. APENAS EXAMES. Coparticipação não cobra aqui.',
    'eeg', 'Paciente agitado NÃO faz. NÃO faz com sedação. NÃO faz em vigília. NÃO faz com ferimento na cabeça.',
    'enmg', 'Todos os exames precisam de guia autorizada com validade no dia.'
  ),
  'valores_particulares', jsonb_build_object(
    'consulta', 400.00,
    'eeg_simples', 120.00,
    'eeg_mapeamento', 180.00,
    'enmg_paralisia_facial', 340.00,
    'enmg_2_membros', 615.00,
    'enmg_4_membros', 1230.00
  ),
  'forma_pagamento', jsonb_build_object(
    'particular', jsonb_build_array('Espécie', 'PIX')
  ),
  'resultados', jsonb_build_object(
    'enmg', '4 a 5 dias úteis (exceção se o doutor fechar agenda)'
  ),
  'servicos', jsonb_build_object(
    'consulta', jsonb_build_object(
      'dias', jsonb_build_array('terça', 'quinta'),
      'horarios', jsonb_build_array('13:00', '14:00', '15:00'),
      'limite_pacientes', 7,
      'chegada_primeiro_grupo', '30 minutos antes do horário agendado',
      'chegada_demais', '15 minutos antes',
      'limite_chegada', '15:30'
    ),
    'eeg', jsonb_build_object(
      'dias', jsonb_build_array('terça', 'sábado'),
      'horarios', jsonb_build_array('08:00', '08:30', '09:00', '09:30'),
      'limite_pacientes', 5,
      'chegada_primeiro_grupo', '30 minutos antes',
      'chegada_demais', '15 minutos antes'
    ),
    'enmg_quarta_manha', jsonb_build_object(
      'dia', 'quarta',
      'periodo', 'manhã',
      'slots', jsonb_build_array(
        jsonb_build_object('horario', '07:30', 'membros', 4, 'chegada', '07:15', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '08:00', 'membros', 2, 'chegada', '07:45', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '09:00', 'membros', 4, 'chegada', '08:45', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '09:30', 'membros', 4, 'chegada', '09:15', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '10:00', 'membros', 4, 'chegada', '09:45', 'convenio', 'MED SAÚDE')
      ),
      'membros_total', 18,
      'chegada', '15 minutos antes'
    ),
    'enmg_quarta_tarde', jsonb_build_object(
      'dia', 'quarta',
      'periodo', 'tarde',
      'slots', jsonb_build_array(
        jsonb_build_object('horario', '13:00', 'membros', 4, 'chegada', '12:45', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '13:30', 'membros', 4, 'chegada', '13:15', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '14:00', 'membros', 4, 'chegada', '13:45', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '14:30', 'membros', 2, 'chegada', '14:15', 'convenio', 'SERTÃO SAÚDE'),
        jsonb_build_object('horario', '15:00', 'membros', 2, 'chegada', '14:45', 'convenio', 'PAC DR.NIVO MELO')
      ),
      'membros_total', 16,
      'chegada', '15 minutos antes'
    ),
    'enmg_sexta_manha', jsonb_build_object(
      'dia', 'sexta',
      'periodo', 'manhã',
      'slots', jsonb_build_array(
        jsonb_build_object('horario', '07:30', 'membros', 4, 'chegada', '07:15'),
        jsonb_build_object('horario', '08:00', 'membros', 4, 'chegada', '07:45'),
        jsonb_build_object('horario', '08:30', 'membros', 4, 'chegada', '08:15'),
        jsonb_build_object('horario', '09:00', 'membros', 4, 'chegada', '08:45'),
        jsonb_build_object('horario', '09:30', 'membros', 4, 'chegada', '09:15')
      ),
      'membros_total', 20,
      'membros_por_hora', 4,
      'chegada', '15 minutos antes'
    ),
    'enmg_sexta_tarde', jsonb_build_object(
      'dia', 'sexta',
      'periodo', 'tarde',
      'slots', jsonb_build_array(
        jsonb_build_object('horario', '13:00', 'membros', 4, 'chegada', '12:45', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '13:30', 'membros', 4, 'chegada', '13:15', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '14:30', 'membros', 4, 'chegada', '14:15', 'convenio', 'GERAL'),
        jsonb_build_object('horario', '15:00', 'membros', 2, 'chegada', '14:45', 'convenio', 'PAC DR.NIVO MELO')
      ),
      'membros_total', 14,
      'membros_dr_nivo', 2,
      'chegada', '15 minutos antes'
    )
  ),
  'mensagens', jsonb_build_object(
    'consulta', 'Consulta Neurológica com Dr. Fábio Drubi. Convênios aceitos: Particular, Medprev, Agenda Vale. Idade mínima: 13 anos. Valor particular: R$400,00. Pagamento: espécie ou PIX. Atendimento terça e quinta (13:00, 14:00, 15:00). Chegar 30 minutos antes (1º grupo) ou 15 minutos antes (demais). Limite de chegada: 15:30.',
    'eeg', 'EEG (Eletroencefalograma) com Dr. Fábio Drubi. Idade mínima: 8 anos. Convênios: Particular, Medprev, Agenda Vale, Unimed (APENAS carteirinha nº 0210 - NÃO atende intercâmbio). RESTRIÇÕES: Paciente agitado NÃO faz. NÃO realiza com sedação, em vigília ou com ferimento na cabeça. Valores particulares: Simples R$120 / Com Mapeamento R$180. Pagamento: PIX ou espécie. Terça e sábado (08:00, 08:30, 09:00, 09:30). Chegar 30min antes (1º grupo), 15min antes (demais).',
    'enmg', 'ENMG (Eletroneuromiografia) com Dr. Fábio Drubi. Idade mínima: 15 anos. Convênios: Unimed (APENAS nº 0210), HGU (guias autorizadas com validade), Medprev, Agenda Vale, Med Saúde, Sertão Saúde, pacientes Dr. Nivo Melo. IMPORTANTE: Todos os exames precisam de guia autorizada com validade no dia. Valores particulares: Paralisia Facial R$340 / 2 membros (MMII ou MMSS) R$615 / 4 membros (MMII + MMSS) R$1.230. Pagamento: PIX ou espécie. Resultados: 4 a 5 dias úteis. Chegar 15 minutos antes do horário.'
  )
)
WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96';
