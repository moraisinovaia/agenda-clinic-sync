-- Aplicar regras especiais para Dr. Heverson Alex
-- Regras: Intervalo 15 dias ECG/Teste Ergométrico + Regras UNIMED

UPDATE business_rules 
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{regras_especiais}',
  '{
    "regras_intervalos": {
      "ECG_para_TESTE_ERGOMETRICO": {
        "exame_origem": ["ECG", "Eletrocardiograma"],
        "exame_bloqueado": ["Teste Ergométrico", "TESTE ERGOMETRICO"],
        "intervalo_dias": 15,
        "mensagem": "ECG e Teste Ergométrico devem ter intervalo mínimo de 15 dias"
      }
    },
    "regras_unimed": {
      "consulta_sempre_com_ecg": true,
      "mapa_holter_nao_aceita": true,
      "observacao": "Paciente UNIMED: consulta sempre com ECG. MAPA/HOLTER não aceita pela UNIMED"
    }
  }'::jsonb
)
WHERE medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487';