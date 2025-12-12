
-- Copiar todos os serviços faltantes da INOVAIA para ENDOGASTRO
-- Usando DISTINCT ON para evitar duplicatas e pegar o registro mais completo

INSERT INTO atendimentos (cliente_id, nome, tipo, codigo, valor_particular, coparticipacao_unimed_20, coparticipacao_unimed_40, observacoes, restricoes, ativo)
SELECT DISTINCT ON (nome)
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'::uuid as cliente_id,
  nome,
  tipo,
  codigo,
  valor_particular,
  coparticipacao_unimed_20,
  coparticipacao_unimed_40,
  observacoes,
  restricoes,
  true as ativo
FROM atendimentos
WHERE cliente_id = (SELECT id FROM clientes WHERE nome = 'INOVAIA')
  AND ativo = true
  AND nome NOT IN (
    SELECT e.nome FROM atendimentos e 
    WHERE e.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253' AND e.ativo = true
  )
ORDER BY nome, codigo NULLS LAST;
