-- ============================================
-- PASSO 3: CRIAR CLÍNICA ORION E COPIAR DADOS
-- ============================================

-- 1. Criar Clínica Orion
INSERT INTO llm_clinic_config (
  cliente_id,
  nome_clinica,
  endereco,
  telefone,
  whatsapp,
  dias_busca_inicial,
  dias_busca_expandida,
  data_minima_agendamento,
  ativo
) VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'Clínica Orion',
  'Av. Presidente Tancredo Neves, 1019 - Centro, Petrolina-PE (esquina do Hotel Íbis)',
  '8730241274',
  '5587981500808',
  14,
  30,
  '2025-01-20',
  true
);

-- 2. Copiar business_rules dos médicos Orion
INSERT INTO business_rules (cliente_id, config_id, medico_id, config, ativo)
SELECT 
  br.cliente_id,
  (SELECT id FROM llm_clinic_config WHERE nome_clinica = 'Clínica Orion' LIMIT 1),
  br.medico_id,
  br.config,
  br.ativo
FROM business_rules br
WHERE br.config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829'
  AND br.medico_id IN (
    '20046e90-52cf-44d7-9586-748f55884bd2',
    '380fc7d2-9587-486b-a968-46556dfc7401',
    'cdbfc594-d3de-459f-a9c1-a3f29842273e',
    'fe51b62b-c688-40ab-b9a6-977e3bd13229',
    '83a15377-8f41-47ff-ab37-a0cb3f9d0135',
    '14e10918-2dca-40f3-a888-05f0ee77f2dd'
  );

-- 3. Copiar mensagens padrão para Orion (genéricas sem medico_id)
INSERT INTO llm_mensagens (cliente_id, config_id, tipo, medico_id, mensagem, ativo)
SELECT 
  lm.cliente_id,
  (SELECT id FROM llm_clinic_config WHERE nome_clinica = 'Clínica Orion' LIMIT 1),
  lm.tipo,
  NULL,
  REPLACE(
    REPLACE(
      REPLACE(lm.mensagem, '87981126744', '87981500808'),
      '87 98112-6744', '87 8150-0808'
    ),
    'Jeniffe ou Luh', 'secretária da Orion'
  ),
  lm.ativo
FROM llm_mensagens lm
WHERE lm.config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829'
  AND lm.medico_id IS NULL;

-- 4. Copiar mensagens específicas dos médicos Orion
INSERT INTO llm_mensagens (cliente_id, config_id, tipo, medico_id, mensagem, ativo)
SELECT 
  lm.cliente_id,
  (SELECT id FROM llm_clinic_config WHERE nome_clinica = 'Clínica Orion' LIMIT 1),
  lm.tipo,
  lm.medico_id,
  REPLACE(
    REPLACE(
      REPLACE(lm.mensagem, '87981126744', '87981500808'),
      '87 98112-6744', '87 8150-0808'
    ),
    'Jeniffe ou Luh', 'secretária da Orion'
  ),
  lm.ativo
FROM llm_mensagens lm
WHERE lm.config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829'
  AND lm.medico_id IN (
    '20046e90-52cf-44d7-9586-748f55884bd2',
    '380fc7d2-9587-486b-a968-46556dfc7401',
    'cdbfc594-d3de-459f-a9c1-a3f29842273e',
    'fe51b62b-c688-40ab-b9a6-977e3bd13229',
    '83a15377-8f41-47ff-ab37-a0cb3f9d0135',
    '14e10918-2dca-40f3-a888-05f0ee77f2dd'
  );