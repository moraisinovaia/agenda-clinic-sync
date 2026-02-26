
-- Atualizar business_rules do Dr. Marcelo para config_id próprio
UPDATE business_rules SET config_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', updated_at = now() WHERE id = '0175d73b-adde-4463-af29-90b5f4c1c349';
UPDATE business_rules SET config_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', updated_at = now() WHERE id = '7273a6cc-5867-41b8-8551-2f2b30e217c0';
UPDATE business_rules SET ativo = false, updated_at = now() WHERE id = '7e08a5cd-270d-4441-9baa-b6a97b7407e6';

-- Atualizar llm_mensagens do Dr. Marcelo para config_id próprio
UPDATE llm_mensagens SET config_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' WHERE id = '462915d6-8117-4684-98a2-26719085e849';
UPDATE llm_mensagens SET config_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' WHERE id = '2c200680-3b5f-4be0-b71b-56fbe7c7f985';
