-- [Endogastro] Alinhamento de distribuicao_recursos com a agenda real da JOANA.
--
-- Contexto: a tabela distribuicao_recursos (usada pela função
-- validar_limite_recurso v2) tinha dados antigos que NÃO refletiam a agenda
-- real da clínica. Atualização das business_rules anterior (migration
-- pré-existente) deixou as 2 fontes desalinhadas.
--
-- Esta migration alinha distribuicao_recursos com a imagem oficial enviada
-- pela clínica (MAPA + HOLTER).
-- ECG NÃO é tocado — não estava na imagem; mantém estado atual.
--
-- Backup salvo em audit_logs antes do UPDATE/INSERT:
--   action='dist_recursos_backup_pre_align_2026_05_06'
--
-- Mudanças (15 ops):
--   8 desativações (rows que não deveriam existir conforme imagem)
--   3 ajustes de quantidade
--   4 inserções novas

-- ─── BACKUP ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_backup jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(d)::jsonb) INTO v_backup
  FROM public.distribuicao_recursos d
  JOIN public.recursos_equipamentos re ON re.id = d.recurso_id
  WHERE re.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
    AND re.nome IN ('MAPA','HOLTER');

  INSERT INTO public.audit_logs (audit_timestamp, action, table_name, record_id, old_values, cliente_id)
  VALUES (now(), 'dist_recursos_backup_pre_align_2026_05_06',
    'distribuicao_recursos', gen_random_uuid(),
    jsonb_build_object('rows', v_backup),
    '39e120b4-5fb7-4d6f-9f91-a598a5bbd253');
END $$;

-- ─── DESATIVAÇÕES (8) — entries que conflitam com a imagem ──────────
-- MAPA Diego ter, MAPA Diego qua, MAPA Heverson qui, MAPA Diego sex
-- HOLTER Max seg, HOLTER Diego qua, HOLTER Max qua, HOLTER Diego sex
UPDATE public.distribuicao_recursos SET ativo = false
WHERE id IN (
  '60bc445a-8c6b-40aa-b37b-9684462a3b6b',  -- MAPA Diego ter
  '90e0db41-75d4-4628-8780-fd888c1eb124',  -- MAPA Diego qua
  '847918a6-6d5d-4d75-b2c6-ab500d787e55',  -- MAPA Heverson qui
  'db7c1433-815f-44d1-86f3-10607f3bd533',  -- MAPA Diego sex
  '067c7829-a846-4427-8a35-5e0a416ef959',  -- HOLTER Max seg
  '815c6428-0b03-4007-aa6e-d52b3b5b31c5',  -- HOLTER Diego qua
  '7c4e39d9-9fbd-4a5b-9079-ad42d0d5632c',  -- HOLTER Max qua
  'f3ee6867-3b6d-4849-a345-cf9094662478'   -- HOLTER Diego sex
);

-- ─── AJUSTES DE QUANTIDADE (3) ──────────────────────────────────────
UPDATE public.distribuicao_recursos SET quantidade = 2
WHERE id = '97ee5946-a71f-4892-bbb9-6116ce57ab86';  -- MAPA Aristófilo ter (4→2)

UPDATE public.distribuicao_recursos SET quantidade = 1
WHERE id IN (
  '547e63e0-f9d7-402a-afd7-913e3c22de72',  -- HOLTER Aristófilo ter (2→1)
  '773699be-4dcb-4c23-bfbb-29b419ca9588'   -- HOLTER Heverson qui (2→1)
);

-- ─── INSERÇÕES NOVAS (4) — entries que faltavam ─────────────────────
-- MAPA Max qua, MAPA Aristófilo sex, HOLTER Max qui, HOLTER Aristófilo qua
INSERT INTO public.distribuicao_recursos (recurso_id, medico_id, dia_semana, quantidade, periodo, ativo, cliente_id)
SELECT re.id, v.medico_id_v, v.dia, v.qty, 'manha', true, '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
FROM (VALUES
  ('MAPA',   '84f434dc-21f6-41a9-962e-9b0722a0e2d4'::uuid, 3, 2),  -- Max qua
  ('MAPA',   'e4298fe4-1d73-4099-83e0-8581cabb7e96'::uuid, 5, 2),  -- Aristófilo sex
  ('HOLTER', '84f434dc-21f6-41a9-962e-9b0722a0e2d4'::uuid, 4, 1),  -- Max qui
  ('HOLTER', 'e4298fe4-1d73-4099-83e0-8581cabb7e96'::uuid, 3, 1)   -- Aristófilo qua
) AS v(recurso_nome, medico_id_v, dia, qty)
JOIN public.recursos_equipamentos re
  ON re.nome = v.recurso_nome AND re.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';
