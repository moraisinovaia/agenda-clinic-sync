-- Corrigir serviços do Dr. Pedro Francisco (Ultrassonografista)
-- Usando o ID correto do médico: 66e9310d-34cd-4005-8937-74e87125dc03
-- Remover serviços de Gastroenterologia, manter apenas os 7 USGs

UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos}',
  '{
    "USG Abdome Total": {"duracao": 30, "permite_online": true, "preparo": "jejum_8h", "requer_acompanhante": false, "periodos": {"manha": {"dias_especificos": [1,2,3,4,5], "fim": "12:00", "inicio": "07:00", "limite": 15}}},
    "USG Abdome Superior": {"duracao": 20, "permite_online": true, "preparo": "jejum_8h", "requer_acompanhante": false, "periodos": {"manha": {"dias_especificos": [1,2,3,4,5], "fim": "12:00", "inicio": "07:00", "limite": 15}}},
    "USG Próstata": {"duracao": 20, "permite_online": true, "preparo": "bexiga_cheia", "requer_acompanhante": false, "periodos": {"manha": {"dias_especificos": [1,2,3,4,5], "fim": "12:00", "inicio": "07:00", "limite": 15}}},
    "USG Tireoide": {"duracao": 20, "permite_online": true, "periodos": {"manha": {"dias_especificos": [1,2,3,4,5], "fim": "12:00", "inicio": "07:00", "limite": 15}}},
    "USG Mama": {"duracao": 20, "permite_online": true, "periodos": {"manha": {"dias_especificos": [1,2,3,4,5], "fim": "12:00", "inicio": "07:00", "limite": 15}}},
    "USG Pélvica": {"duracao": 20, "permite_online": true, "preparo": "bexiga_cheia", "requer_acompanhante": false, "periodos": {"manha": {"dias_especificos": [1,2,3,4,5], "fim": "12:00", "inicio": "07:00", "limite": 15}}},
    "USG Vias Urinárias": {"duracao": 20, "permite_online": true, "preparo": "bexiga_cheia", "requer_acompanhante": false, "periodos": {"manha": {"dias_especificos": [1,2,3,4,5], "fim": "12:00", "inicio": "07:00", "limite": 15}}}
  }'::jsonb
)
WHERE medico_id = '66e9310d-34cd-4005-8937-74e87125dc03'
AND config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829';