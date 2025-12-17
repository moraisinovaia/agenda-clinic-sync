-- Desabilitar todos os triggers temporariamente
SET session_replication_role = 'replica';

-- Fase 1: Limpeza dos atendimentos duplicados
-- 1. Atualizar agendamentos que usam IDs duplicados
WITH registros_manter AS (
  SELECT DISTINCT ON (lower(nome), lower(tipo), cliente_id) 
    id as id_manter, nome, tipo, cliente_id
  FROM atendimentos
  ORDER BY lower(nome), lower(tipo), cliente_id, created_at ASC
),
registros_remover AS (
  SELECT a.id as id_remover, rm.id_manter
  FROM atendimentos a
  JOIN registros_manter rm ON lower(rm.nome) = lower(a.nome) AND lower(rm.tipo) = lower(a.tipo) AND rm.cliente_id = a.cliente_id
  WHERE a.id != rm.id_manter
)
UPDATE agendamentos 
SET atendimento_id = rr.id_manter
FROM registros_remover rr
WHERE agendamentos.atendimento_id = rr.id_remover;

-- 2. Atualizar fila_espera que usam IDs duplicados
WITH registros_manter AS (
  SELECT DISTINCT ON (lower(nome), lower(tipo), cliente_id) 
    id as id_manter, nome, tipo, cliente_id
  FROM atendimentos
  ORDER BY lower(nome), lower(tipo), cliente_id, created_at ASC
),
registros_remover AS (
  SELECT a.id as id_remover, rm.id_manter
  FROM atendimentos a
  JOIN registros_manter rm ON lower(rm.nome) = lower(a.nome) AND lower(rm.tipo) = lower(a.tipo) AND rm.cliente_id = a.cliente_id
  WHERE a.id != rm.id_manter
)
UPDATE fila_espera 
SET atendimento_id = rr.id_manter
FROM registros_remover rr
WHERE fila_espera.atendimento_id = rr.id_remover;

-- Reabilitar triggers
SET session_replication_role = 'origin';

-- 3. Deletar os registros duplicados
DELETE FROM atendimentos 
WHERE id NOT IN (
  SELECT DISTINCT ON (lower(nome), lower(tipo), cliente_id) id
  FROM atendimentos
  ORDER BY lower(nome), lower(tipo), cliente_id, created_at ASC
);

-- Fase 2: Prevenir duplicados futuros com índice UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS atendimentos_unique_nome_tipo_cliente 
ON atendimentos (lower(nome), lower(tipo), cliente_id) 
WHERE ativo = true;