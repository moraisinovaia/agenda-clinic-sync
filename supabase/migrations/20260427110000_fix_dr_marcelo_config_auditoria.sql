-- ===================================================================
-- Correção dos dados do Dr. Marcelo D'Carli — auditoria do PDF
-- 1. MEDPREV: sai de convenios_aceitos → vai para convenios_parceiros
-- 2. Typo CASEMPRABA → CASEMBRAPA
-- 3. atendimento_inicio Consulta manhã: 07:45 → 07:30
-- ===================================================================

UPDATE public.business_rules
SET
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          config,

          -- Fix 1: convenios_aceitos — remove MEDPREV + corrige typo CASEMBRAPA
          '{convenios_aceitos}',
          (
            SELECT COALESCE(
              jsonb_agg(
                CASE WHEN elem::text = '"CASEMPRABA (PERIODICO)"'
                     THEN '"CASEMBRAPA (PERIODICO)"'::jsonb
                     ELSE elem
                END
              ),
              '[]'::jsonb
            )
            FROM jsonb_array_elements(config->'convenios_aceitos') AS elem
            WHERE elem::text != '"MEDPREV"'
          )
        ),

        -- Fix 2: convenios (campo duplicado) — mesma correção
        '{convenios}',
        (
          SELECT COALESCE(
            jsonb_agg(
              CASE WHEN elem::text = '"CASEMPRABA (PERIODICO)"'
                   THEN '"CASEMBRAPA (PERIODICO)"'::jsonb
                   ELSE elem
              END
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(config->'convenios') AS elem
          WHERE elem::text != '"MEDPREV"'
        )
      ),

      -- Fix 3: criar convenios_parceiros com MEDPREV
      '{convenios_parceiros}',
      jsonb_build_object(
        'lista',    '["MEDCLIN","MEDPREV","SEDILAB","CLINICA VIDA","CLINCENTER","SERTAO SAUDE"]'::jsonb,
        'mensagem', 'Informações sobre atendimento devem ser obtidas diretamente com o convênio parceiro.'
      )
    ),

    -- Fix 4: atendimento_inicio da Consulta Cardiológica manhã: 07:45 → 07:30
    ARRAY['servicos', 'Consulta Cardiológica', 'periodos', 'manha', 'atendimento_inicio'],
    '"07:30"'
  ),
  updated_at = now(),
  version    = version + 1
WHERE config_id  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND medico_id  = '1e110923-50df-46ff-a57a-29d88e372900'; -- Dr. Marcelo D'Carli principal
