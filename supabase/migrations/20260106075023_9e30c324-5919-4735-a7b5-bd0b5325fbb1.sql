-- ============================================================
-- Configuração Dr. Diego Tomás - Atualização Completa
-- ============================================================

-- 1. Criar recurso ECO (Ecocardiograma)
INSERT INTO recursos_equipamentos (
  id,
  nome,
  descricao,
  limite_diario,
  cliente_id,
  ativo
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'ECO',
  'Ecocardiograma - Idade mínima 18 anos',
  8,
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  true
);

-- 2. Distribuições ECO - Dr. Diego Tomás (NOVAS)
-- Terça (6 ecos 10:00-11:30)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo, cliente_id)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '04505052-89c5-4090-9921-806a6fc7b544', 2, 6, 'manha', '10:00', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- Sexta manhã (6 ecos 10:00-11:30)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo, cliente_id)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '04505052-89c5-4090-9921-806a6fc7b544', 5, 6, 'manha', '10:00', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- Sexta tarde (8 ecos 15:00-16:00)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo, cliente_id)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '04505052-89c5-4090-9921-806a6fc7b544', 5, 8, 'tarde', '15:00', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- 3. ATUALIZAR distribuições ECG existentes para horários corretos
-- Segunda: 13:00-14:00 (atualmente está 14:00)
UPDATE distribuicao_recursos 
SET horario_inicio = '13:00', quantidade = 8
WHERE id = 'ced7516e-c1ef-4b78-bc38-524d711ea12e';

-- Terça: REMOVER (não tem ECG terça conforme nova agenda)
DELETE FROM distribuicao_recursos 
WHERE id = '5e498f9e-a1ec-4b7c-8784-ae58f81e9926';

-- Sexta manhã: 07:00-08:30 (atualmente está 08:00)
UPDATE distribuicao_recursos 
SET horario_inicio = '07:00', quantidade = 8
WHERE id = '172742dd-719e-404d-861d-4009a460e333';

-- Sexta tarde: 13:00-14:00 (atualmente está 14:00)
UPDATE distribuicao_recursos 
SET horario_inicio = '13:00', quantidade = 8
WHERE id = '126742bb-769f-41d1-9b41-c4b2579560a6';

-- 4. ATUALIZAR MAPA existentes para horário 08:00
UPDATE distribuicao_recursos 
SET horario_inicio = '08:00', periodo = 'manha', quantidade = 2
WHERE id IN ('42a4053c-bc23-4c33-8277-7cac29d44b8b', '5678d685-cc34-4996-a55d-3f1f52addf70', 'bc1ab1f1-0b70-4a3b-9aea-d091b3296dd3');

-- Inserir MAPA para dias faltantes (Terça e Quarta)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo, cliente_id)
VALUES 
  ('403a0030-0922-4050-a278-239ca2781098', '04505052-89c5-4090-9921-806a6fc7b544', 2, 2, 'manha', '08:00', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
  ('403a0030-0922-4050-a278-239ca2781098', '04505052-89c5-4090-9921-806a6fc7b544', 3, 2, 'manha', '08:00', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- 5. ATUALIZAR HOLTER existentes para horário 08:00
UPDATE distribuicao_recursos 
SET horario_inicio = '08:00', periodo = 'manha', quantidade = 2
WHERE id IN ('d43be5da-6e17-4ad1-8ced-3929efb0aa2d', '401aa0a0-d70e-46ea-9f86-0bb86744a003', '449dd433-f6aa-4fbb-a294-79acc2a10c9a');

-- Inserir HOLTER para dias faltantes (Terça e Quarta)
INSERT INTO distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo, cliente_id)
VALUES 
  ('0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', '04505052-89c5-4090-9921-806a6fc7b544', 2, 2, 'manha', '08:00', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
  ('0d80b73f-e0b0-4b46-98fe-d2b09ae4952b', '04505052-89c5-4090-9921-806a6fc7b544', 3, 2, 'manha', '08:00', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');

-- 6. Atualizar business_rules com consultas, retornos e ECO
UPDATE business_rules
SET 
  config = jsonb_set(
    config,
    '{servicos,Consulta Cardiológica}',
    '{
      "dias_atendimento": ["segunda", "sexta"],
      "idade_minima": 15,
      "valor_particular": 280,
      "periodos": {
        "segunda": {
          "periodo": "tarde",
          "consultas": {
            "quantidade": 5,
            "horario_inicio": "14:00",
            "horario_fim": "15:00"
          }
        },
        "sexta": {
          "periodo": "tarde",
          "consultas": {
            "quantidade": 5,
            "horario_inicio": "14:00",
            "horario_fim": "15:00"
          },
          "retornos": {
            "quantidade": 3,
            "horario_inicio": "14:00",
            "horario_fim": "15:00"
          }
        }
      },
      "ecocardiograma": {
        "idade_minima": 18,
        "dias": ["terca", "sexta"],
        "capacidade": 8
      }
    }'::jsonb
  ),
  updated_at = NOW(),
  version = version + 1
WHERE medico_id = '04505052-89c5-4090-9921-806a6fc7b544';