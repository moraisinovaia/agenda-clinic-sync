-- Remover constraint antiga e adicionar uma mais flexível
ALTER TABLE public.llm_mensagens DROP CONSTRAINT IF EXISTS llm_mensagens_tipo_check;

-- Adicionar constraint mais flexível com todos os tipos necessários
ALTER TABLE public.llm_mensagens ADD CONSTRAINT llm_mensagens_tipo_check 
CHECK (tipo IN (
  'bloqueio_agenda', 
  'confirmacao_agendamento', 
  'data_bloqueada', 
  'sem_disponibilidade', 
  'agendamentos_antigos',
  'boas_vindas',
  'encerramento',
  'erro_generico',
  'ordem_chegada',
  'hora_marcada'
));