-- ===================================================================
-- CORRETIVA: reverte efeitos colaterais da migration 20260427110000
--
-- Problema: a migration original usou WHERE config_id = 'a1b2c3d4-...'
-- sem restringir por medico_id. Isso afetou todos os registros de
-- business_rules sob o mesmo config_id, incluindo os registros
-- secundários de agendas virtuais do Dr. Marcelo:
--   - 7273a6cc (Teste Ergométrico virtual)
--   - 0175d73b (MRPA virtual)
--   - 7e08a5cd (registro antigo, ativo=false)
--
-- Efeitos indevidos nesses registros:
--   1. convenios_parceiros adicionado (não existia antes)
--   2. convenios_aceitos setado para [] (era ausente → COALESCE devolveu [])
--   3. convenios setado para [] (idem)
--
-- Esta migration:
--   - NÃO toca o Dr. Marcelo principal (medico_id = '1e110923-...')
--   - NÃO toca servicos.*.convenios_aceitos (nunca foram alterados)
--   - É idempotente: só atualiza se config realmente mudou
-- ===================================================================

WITH correcao AS (
  SELECT
    id,
    step3.cfg AS config_corrigido
  FROM public.business_rules
  CROSS JOIN LATERAL (
    -- Passo 1: remover convenios_parceiros adicionado indevidamente
    SELECT
      CASE WHEN config ? 'convenios_parceiros'
           THEN config - 'convenios_parceiros'
           ELSE config
      END AS cfg
  ) step1
  CROSS JOIN LATERAL (
    -- Passo 2: remover convenios_aceitos se foi zerado (estava ausente antes)
    SELECT
      CASE WHEN step1.cfg -> 'convenios_aceitos' = '[]'::jsonb
           THEN step1.cfg - 'convenios_aceitos'
           ELSE step1.cfg
      END AS cfg
  ) step2
  CROSS JOIN LATERAL (
    -- Passo 3: remover convenios se foi zerado (idem)
    SELECT
      CASE WHEN step2.cfg -> 'convenios' = '[]'::jsonb
           THEN step2.cfg - 'convenios'
           ELSE step2.cfg
      END AS cfg
  ) step3
  WHERE config_id  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND medico_id != '1e110923-50df-46ff-a57a-29d88e372900'  -- preserva Dr. Marcelo principal
    AND step3.cfg IS DISTINCT FROM config                     -- só atualiza se houve mudança real
)
UPDATE public.business_rules br
SET
  config     = correcao.config_corrigido,
  updated_at = now(),
  version    = version + 1
FROM correcao
WHERE br.id = correcao.id;
