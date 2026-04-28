-- Clínica Olhos HOP — Dra. Isabela do Nascimento Fonseca
-- Fix 1: adiciona HGU a convenios_aceitos (medicos + business_rules)
-- Fix 2: cria atendimento Retorno e vínculo na pivot medico_atendimento

DO $$
DECLARE
  v_cliente_id  uuid := 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a';
  v_medico_id   uuid;
  v_atend_id    uuid;
BEGIN
  -- Resolver medico_id pelo nome
  SELECT id INTO v_medico_id
    FROM public.medicos
   WHERE cliente_id = v_cliente_id
     AND nome = 'Dra. Isabela do Nascimento Fonseca'
     AND ativo = true
   LIMIT 1;

  IF v_medico_id IS NULL THEN
    RAISE EXCEPTION 'Médica não encontrada para cliente_id=%', v_cliente_id;
  END IF;

  -- ── Fix 1: HGU em medicos.convenios_aceitos ──
  UPDATE public.medicos
     SET convenios_aceitos = array_append(convenios_aceitos, 'HGU'),
         updated_at = now()
   WHERE id = v_medico_id
     AND NOT ('HGU' = ANY(convenios_aceitos));

  -- ── Fix 2: HGU no JSONB do business_rules ──
  UPDATE public.business_rules
     SET config = jsonb_set(
           config,
           '{convenios_aceitos}',
           (config->'convenios_aceitos') || '"HGU"'
         ),
         updated_at = now()
   WHERE medico_id  = v_medico_id
     AND cliente_id = v_cliente_id
     AND ativo = true
     AND NOT (config->'convenios_aceitos' @> '"HGU"');

  -- ── Fix 3: criar atendimento Retorno (idempotente) ──
  INSERT INTO public.atendimentos
    (cliente_id, medico_id, medico_nome, nome, tipo, ativo)
  VALUES
    (v_cliente_id, v_medico_id, 'Dra. Isabela do Nascimento Fonseca', 'Retorno', 'retorno', true)
  ON CONFLICT DO NOTHING;

  -- Buscar o id independente de ter inserido agora ou já existir
  SELECT id INTO v_atend_id
    FROM public.atendimentos
   WHERE cliente_id = v_cliente_id
     AND medico_id  = v_medico_id
     AND nome       = 'Retorno'
   LIMIT 1;

  IF v_atend_id IS NULL THEN
    RAISE EXCEPTION 'Atendimento Retorno não encontrado após INSERT';
  END IF;

  -- ── Fix 4: vincular na pivot medico_atendimento ──
  INSERT INTO public.medico_atendimento
    (medico_id, atendimento_id, cliente_id, ativo)
  VALUES
    (v_medico_id, v_atend_id, v_cliente_id, true)
  ON CONFLICT (medico_id, atendimento_id) DO NOTHING;

  RAISE NOTICE 'OK: medico_id=%, atend_id=%', v_medico_id, v_atend_id;
END $$;
