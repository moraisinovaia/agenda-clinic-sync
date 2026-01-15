-- Corrigir serviços da Dra. Adriana Carla de Sena (Endocrinologista)
-- Trocar serviços de Gastroenterologia para Endocrinologia

UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos}',
  '{
    "Consulta Endocrinológica": {"ativo": true, "periodos": []},
    "Retorno Endocrinológico": {"ativo": true, "periodos": []}
  }'::jsonb
)
WHERE medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'
AND config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829';

-- Corrigir serviços do Dr. Pedro Francisco (Ultrassonografista)
-- Remover serviços de Gastroenterologia, manter apenas USGs

UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos}',
  '{
    "USG Abdome Total": {"ativo": true, "periodos": []},
    "USG Abdome Superior": {"ativo": true, "periodos": []},
    "USG Próstata": {"ativo": true, "periodos": []},
    "USG Tireoide": {"ativo": true, "periodos": []},
    "USG Mama": {"ativo": true, "periodos": []},
    "USG Pélvica": {"ativo": true, "periodos": []},
    "USG Vias Urinárias": {"ativo": true, "periodos": []}
  }'::jsonb
)
WHERE medico_id = '131b30b9-30b5-4e7b-9904-5cca9affa48b'
AND config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829';