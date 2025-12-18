-- Adicionar novos tipos ao constraint de llm_mensagens
ALTER TABLE llm_mensagens DROP CONSTRAINT IF EXISTS llm_mensagens_tipo_check;

ALTER TABLE llm_mensagens ADD CONSTRAINT llm_mensagens_tipo_check 
CHECK (tipo = ANY (ARRAY[
  'bloqueio_agenda'::text, 
  'confirmacao_agendamento'::text, 
  'data_bloqueada'::text, 
  'sem_disponibilidade'::text, 
  'agendamentos_antigos'::text, 
  'boas_vindas'::text, 
  'encerramento'::text, 
  'erro_generico'::text, 
  'ordem_chegada'::text, 
  'hora_marcada'::text,
  'encaixe'::text,
  'servico_nao_agendavel'::text
]));