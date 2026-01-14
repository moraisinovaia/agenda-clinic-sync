-- Remover mensagens LLM duplicadas do IPADO
-- Dr. Dilson e Dr. Sydney agora são exclusivos da Clínica Orion

DELETE FROM llm_mensagens
WHERE id IN (
  '6d246e0a-fe5d-41c0-b622-18c1fd7ac6c8',  -- Dr. Dilson - hora_marcada
  '8423f4a1-1fa8-4da3-88cc-ba39303ca793',  -- Dr. Dilson - servico_nao_agendavel  
  'ffeaca46-58d7-448b-8008-3de03c76d5df'   -- Dr. Sydney - bloqueio_agenda
)
AND config_id = '20b48124-ae41-4e54-8a7e-3e236b8b4829';