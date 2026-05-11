-- [Endogastro] Vincula cardiologistas aos atendimentos com sufixo do médico.
--
-- Contexto: 12 atendimentos chamados "MAPA (DR XXX)", "Holter (DR XXX)",
-- "ECG (DR XXX)" tinham apenas a JOANA (enfermeira executora) vinculada via
-- medico_atendimento. Faltava o vínculo com o cardiologista dono do exame.
--
-- Sintoma do bug: quando recepção agendava com medico=JOANA + atendimento
-- "MAPA (DR DIEGO)", a função validar_limite_recurso buscava
-- distribuicao_recursos pra JOANA (não tem) → bloqueava com:
--   "MAPA não disponível para JOANA neste dia da semana"
--
-- Fix: adicionar 12 entries em medico_atendimento (4 cardios x 3 recursos)
-- pra que a função (v2 — ver migration 20260506163900) consiga descobrir
-- "quem é o dono real do exame" e usar a distribuição correta dele.

INSERT INTO public.medico_atendimento (medico_id, atendimento_id, cliente_id, ativo)
SELECT
  CASE
    WHEN a.nome ILIKE '%ARISTÓFILO%' OR a.nome ILIKE '%ARISTOFILO%' THEN 'e4298fe4-1d73-4099-83e0-8581cabb7e96'::uuid
    WHEN a.nome ILIKE '%DIEGO%'    THEN '04505052-89c5-4090-9921-806a6fc7b544'::uuid
    WHEN a.nome ILIKE '%HEVERSON%' THEN 'fdb7862c-e83d-4294-a36c-a61f177c9487'::uuid
    WHEN a.nome ILIKE '%MAX%'      THEN '84f434dc-21f6-41a9-962e-9b0722a0e2d4'::uuid
  END AS medico_id,
  a.id,
  a.cliente_id,
  true
FROM public.atendimentos a
WHERE a.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
  AND a.ativo = true
  AND a.nome ~* '\((DR\.?\s+(ARIST[ÓO]FILO|DIEGO|HEVERSON|MAX))\s*\)'
  AND (a.nome ILIKE 'MAPA%' OR a.nome ILIKE 'Holter%' OR a.nome ILIKE 'ECG%')
  AND NOT EXISTS (
    SELECT 1 FROM public.medico_atendimento ma
    WHERE ma.atendimento_id = a.id
      AND ma.medico_id IN (
        'e4298fe4-1d73-4099-83e0-8581cabb7e96',
        '04505052-89c5-4090-9921-806a6fc7b544',
        'fdb7862c-e83d-4294-a36c-a61f177c9487',
        '84f434dc-21f6-41a9-962e-9b0722a0e2d4'
      )
  );

COMMENT ON CONSTRAINT medico_atendimento_pkey ON public.medico_atendimento IS
  'JOANA continua vinculada como executora; os cardios também ficam vinculados como donos pra função validar_limite_recurso descobrir distribuição correta.';
