-- Remover a versão antiga da função criar_agendamento_atomico que causa conflito
-- Esta versão tem o parâmetro p_cliente_id que causa ambiguidade
DROP FUNCTION IF EXISTS public.criar_agendamento_atomico(
  p_nome_completo text, 
  p_data_nascimento date, 
  p_convenio text, 
  p_telefone text, 
  p_celular text, 
  p_medico_id uuid, 
  p_atendimento_id uuid, 
  p_data_agendamento date, 
  p_hora_agendamento time without time zone, 
  p_observacoes text, 
  p_criado_por text, 
  p_criado_por_user_id uuid, 
  p_cliente_id uuid, 
  p_agendamento_id_edicao uuid, 
  p_forcar_conflito boolean
);

-- Verificar se apenas uma versão da função permanece
-- A versão correta deve ser a que NÃO tem p_cliente_id como parâmetro