
UPDATE business_rules 
SET config = jsonb_set(
  config,
  '{servicos}',
  (config->'servicos') - 'MAPA MRPA' || 
  '{"MRPA MANHÃ": {"mensagem": "Para marcar MRPA manhã com o Dr. Marcelo é apenas com a secretária Jeniffer pelo WhatsApp: 87981126744 (não recebe ligação).", "permite_online": false}, "MRPA TARDE": {"mensagem": "Para marcar MRPA tarde com o Dr. Marcelo é apenas com a secretária Jeniffer pelo WhatsApp: 87981126744 (não recebe ligação).", "permite_online": false}}'::jsonb
),
updated_at = now()
WHERE id = '0175d73b-adde-4463-af29-90b5f4c1c349';
