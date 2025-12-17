-- FASE 3: LIMPEZA DE DADOS ÓRFÃOS

-- Desativar cliente INOVAIA (era apenas teste)
UPDATE clientes SET ativo = false WHERE nome = 'INOVAIA';

-- Remover atendimentos INOVAIA (não usados em produção)
DELETE FROM atendimentos WHERE cliente_id = '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1';

-- Remover preparos INOVAIA
DELETE FROM preparos WHERE cliente_id = '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1';