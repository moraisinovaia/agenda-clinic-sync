
-- =====================================================
-- ATUALIZAÇÃO: Códigos TUSS e Coparticipação - Dr. Fábio Drubi
-- Médico ID: 477006ad-d1e2-47f8-940a-231f873def96
-- Cliente ID: 39e120b4-5fb7-4d6f-9f91-a598a5bbd253
-- =====================================================

-- 1. INSERIR ATENDIMENTOS ADICIONAIS
-- ENMG Segmento Complementar (técnica)
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'ENMG Segmento Complementar', 'exame', 49.60, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'ENMG Segmento Complementar'
);

-- ENMG Segmento Especial (x2)
INSERT INTO atendimentos (cliente_id, medico_id, nome, tipo, valor_particular, ativo)
SELECT '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', '477006ad-d1e2-47f8-940a-231f873def96', 'ENMG Segmento Especial (x2)', 'exame', 76.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM atendimentos 
  WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96' 
  AND nome = 'ENMG Segmento Especial (x2)'
);

-- 2. ATUALIZAR BUSINESS RULES COM CÓDIGOS E COPARTICIPAÇÃO
UPDATE business_rules
SET config = config || jsonb_build_object(
  'codigos_tuss', jsonb_build_object(
    'enmg_mmss', jsonb_build_object('codigo', '40103323', 'valor', 615.00),
    'enmg_mmii', jsonb_build_object('codigo', '40103315', 'valor', 615.00),
    'enmg_4_membros', jsonb_build_object('codigo', '40103331', 'valor', 1230.00),
    'eeg_mapeamento', jsonb_build_object('codigo', '40103196', 'valor', 180.00),
    'eeg_simples', jsonb_build_object('codigo', '40103234', 'valor', 120.00),
    'enmg_face', jsonb_build_object('codigo', '40103307', 'valor', 340.00),
    'enmg_segmento_complementar', jsonb_build_object('codigo', '40103340', 'valor', 49.60, 'tipo', 'técnica'),
    'enmg_segmento_especial', jsonb_build_object('codigo', '4010358', 'valor', 38.00, 'multiplicador', 2)
  ),
  'coparticipacao', jsonb_build_object(
    'enmg_mmss', jsonb_build_object('20%', 88.80, '40%', 177.60),
    'enmg_mmii', jsonb_build_object('20%', 78.60, '40%', 157.20),
    'enmg_4_membros', jsonb_build_object('20%', 150.00, '40%', 300.00),
    'eeg_mapeamento', jsonb_build_object('20%', 28.00, '40%', 56.00),
    'eeg_simples', jsonb_build_object('20%', 21.00, '40%', 42.00),
    'enmg_face', jsonb_build_object('20%', 56.20, '40%', 112.40),
    'enmg_segmento_complementar', jsonb_build_object('20%', 49.60, '40%', 99.20),
    'enmg_segmento_especial', jsonb_build_object('20%', 38.00, '40%', 76.00, 'multiplicador', 2)
  )
)
WHERE medico_id = '477006ad-d1e2-47f8-940a-231f873def96';
