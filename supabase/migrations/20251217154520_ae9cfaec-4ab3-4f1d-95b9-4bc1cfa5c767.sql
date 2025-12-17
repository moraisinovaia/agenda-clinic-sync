-- FASE 6: PADRONIZAÇÃO DE CONFIGURAÇÕES

-- Criar llm_clinic_config para Clínica Vênus se não existir
INSERT INTO llm_clinic_config (
  cliente_id, nome_clinica, telefone, endereco, whatsapp,
  dias_busca_inicial, dias_busca_expandida, data_minima_agendamento
)
SELECT 
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a',
  'Clínica Vênus',
  '(87) 3835-1234',
  'Petrolina, PE',
  '5587999999999',
  14, 45, CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM llm_clinic_config WHERE cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a'
);

-- Criar llm_clinic_config para ENDOGASTRO se não existir
INSERT INTO llm_clinic_config (
  cliente_id, nome_clinica, telefone, endereco, whatsapp,
  dias_busca_inicial, dias_busca_expandida, data_minima_agendamento
)
SELECT 
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'ENDOGASTRO',
  '(87) 3835-1000',
  'Petrolina, PE',
  '5587988888888',
  14, 45, CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM llm_clinic_config WHERE cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);