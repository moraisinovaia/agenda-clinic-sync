-- 1. Atualizar ECG Terça (dia_semana = 2) - Dr. Max
UPDATE distribuicao_recursos 
SET quantidade = 8, horario_inicio = '13:00:00'
WHERE medico_id = '84f434dc-21f6-41a9-962e-9b0722a0e2d4'
  AND recurso_id = 'dfdd7cf0-8958-4ff8-8928-e614bb578d4a'
  AND dia_semana = 2;

-- 2. Atualizar ECG Quinta (dia_semana = 4) - Dr. Max
UPDATE distribuicao_recursos 
SET quantidade = 8, horario_inicio = '13:00:00', periodo = 'tarde'
WHERE medico_id = '84f434dc-21f6-41a9-962e-9b0722a0e2d4'
  AND recurso_id = 'dfdd7cf0-8958-4ff8-8928-e614bb578d4a'
  AND dia_semana = 4;

-- 3. Adicionar TESTE ERGOMÉTRICO Terça - Dr. Max
INSERT INTO distribuicao_recursos (
  cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo
) VALUES (
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '745c9474-7aeb-4be7-9fe2-c6aa7fe1e993',
  '84f434dc-21f6-41a9-962e-9b0722a0e2d4',
  2, 3, 'tarde', '15:00:00', true
);

-- 4. Adicionar TESTE ERGOMÉTRICO Quinta - Dr. Max
INSERT INTO distribuicao_recursos (
  cliente_id, recurso_id, medico_id, dia_semana, quantidade, periodo, horario_inicio, ativo
) VALUES (
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '745c9474-7aeb-4be7-9fe2-c6aa7fe1e993',
  '84f434dc-21f6-41a9-962e-9b0722a0e2d4',
  4, 3, 'tarde', '15:00:00', true
);