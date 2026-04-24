-- HOTFIX EMERGENCIAL: compatibilidade com frontend legado (Lovable não atualizado)
--
-- Problema: Migration de deduplicação M:N removeu 115 atendimentos duplicados.
-- O frontend antigo filtra atendimentos.medico_id = doctorId — para médicos cujo
-- atendimento era duplicata (não canônico), os serviços sumiram da tela.
--
-- Solução: Inserir cópias "sombra" dos canônicos com medico_id = médico afetado,
-- e adicionar entradas no pivot para essas cópias (para que validar_par_medico_atendimento passe).
--
-- CLEANUP: Remover após deploy do novo frontend.
-- Identificação: restricoes LIKE '%[HOTFIX_LEGADO]%'

WITH broken_pairs AS (
  SELECT
    ma.medico_id            AS target_medico_id,
    a.cliente_id,
    a.nome,
    a.tipo,
    a.codigo,
    COALESCE(ma.valor_override, a.valor_particular) AS valor_particular,
    a.valor_particular_avista,
    a.valor_monocular,
    a.valor_monocular_avista,
    a.coparticipacao_unimed_20,
    a.coparticipacao_unimed_40,
    a.forma_pagamento,
    a.observacoes,
    -- Marca para facilitar cleanup posterior
    COALESCE(a.restricoes, '') || ' [HOTFIX_LEGADO]' AS restricoes,
    a.horarios,
    a.ativo,
    ma.valor_override
  FROM public.medico_atendimento ma
  JOIN public.atendimentos a ON a.id = ma.atendimento_id
  WHERE ma.ativo = true
    AND a.ativo = true
    AND COALESCE(a.medico_id::text, '') <> ma.medico_id::text
),
inserted AS (
  INSERT INTO public.atendimentos (
    cliente_id, nome, tipo, codigo,
    valor_particular, valor_particular_avista,
    valor_monocular, valor_monocular_avista,
    coparticipacao_unimed_20, coparticipacao_unimed_40,
    forma_pagamento, observacoes, restricoes,
    horarios, ativo, medico_id, created_at
  )
  SELECT
    bp.cliente_id, bp.nome, bp.tipo, bp.codigo,
    bp.valor_particular, bp.valor_particular_avista,
    bp.valor_monocular, bp.valor_monocular_avista,
    bp.coparticipacao_unimed_20, bp.coparticipacao_unimed_40,
    bp.forma_pagamento, bp.observacoes, bp.restricoes,
    bp.horarios, bp.ativo, bp.target_medico_id, now()
  FROM broken_pairs bp
  RETURNING id, medico_id, cliente_id
)
INSERT INTO public.medico_atendimento (medico_id, atendimento_id, cliente_id, valor_override, ativo)
SELECT i.medico_id, i.id, i.cliente_id, NULL, true
FROM inserted i
ON CONFLICT DO NOTHING;
