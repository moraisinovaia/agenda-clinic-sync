-- Pro Oftalmo (Dra. Suely) — converte Consulta e Retorno para HORA MARCADA.
--
-- Modelo: slots de 15 min.
--   Manhã: 09:30-12:30 → 12 slots (09:30, 09:45, ..., 12:15)
--   Tarde: 14:30-17:00 → 10 slots (14:30, 14:45, ..., 16:45)
--
-- Sistema lê `intervalo_minutos` do período em availability.ts:2286
-- e `servico.tipo_agendamento === 'hora_marcada'` na linha 1728.
-- Cada slot vira um agendamento individual (1 paciente por hora).
--
-- IMPORTANTE: `fim` é exclusivo no loop (while horaAtual < horaLimite).
-- Por isso fim=12:30 gera até 12:15; fim=17:00 gera até 16:45.

DO $$
DECLARE
  v_br_id uuid := '901daff7-bae6-4d0e-8720-2d0dc9983a24';
BEGIN
  -- Atualiza tipo de agendamento na raiz do config
  UPDATE public.business_rules
  SET config = jsonb_set(config, '{tipo_agendamento}', '"hora_marcada"'::jsonb)
  WHERE id = v_br_id;

  -- Atualiza serviço Consulta: tipo_agendamento + intervalo + limites + horas
  UPDATE public.business_rules
  SET config = jsonb_set(
    config, '{servicos,Consulta}',
    (config->'servicos'->'Consulta')
      || jsonb_build_object(
        'tipo_agendamento', 'hora_marcada',
        'intervalo_minutos', 15,
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object(
            'ativo',  true,
            'inicio', '09:30',
            'fim',    '12:30',
            'intervalo_minutos', 15,
            'limite', 12,
            'dias_especificos', jsonb_build_array(1,2,3,4,5)
          ),
          'tarde', jsonb_build_object(
            'ativo',  true,
            'inicio', '14:30',
            'fim',    '17:00',
            'intervalo_minutos', 15,
            'limite', 10,
            'dias_especificos', jsonb_build_array(1,2,3,4,5)
          )
        )
      )
  )
  WHERE id = v_br_id;

  -- Mesmo update para o serviço Retorno
  UPDATE public.business_rules
  SET config = jsonb_set(
    config, '{servicos,Retorno}',
    (config->'servicos'->'Retorno')
      || jsonb_build_object(
        'tipo_agendamento', 'hora_marcada',
        'intervalo_minutos', 15,
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object(
            'ativo',  true,
            'inicio', '09:30',
            'fim',    '12:30',
            'intervalo_minutos', 15,
            'limite', 12,
            'dias_especificos', jsonb_build_array(1,2,3,4,5)
          ),
          'tarde', jsonb_build_object(
            'ativo',  true,
            'inicio', '14:30',
            'fim',    '17:00',
            'intervalo_minutos', 15,
            'limite', 10,
            'dias_especificos', jsonb_build_array(1,2,3,4,5)
          )
        )
      )
  )
  WHERE id = v_br_id;
END $$;
