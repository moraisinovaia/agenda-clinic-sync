-- Atualizar/Criar médicos para cliente IPADO
-- Cliente IPADO ID: 2bfb98b5-ae41-4f96-8ba7-acc797c22054

-- Log da operação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Atualizando médicos para cliente IPADO',
  'MEDICOS_UPDATE_IPADO',
  jsonb_build_object(
    'cliente', 'IPADO',
    'operacao', 'update_create_medicos'
  )
);

-- 1. Atualizar Dra. Adriana Carla de Sena (reativar e corrigir dados)
UPDATE public.medicos 
SET 
  ativo = true,
  especialidade = 'Endocrinologista (apenas adultos)',
  idade_minima = 18,
  idade_maxima = NULL,
  convenios_aceitos = ARRAY[
    'Unimed Nacional',
    'Unimed Regional', 
    'Unimed Intercâmbio',
    'Unimed 40%',
    'Unimed 20%',
    'Particular'
  ],
  observacoes = 'Atendimentos: Consulta e Retorno. Atende apenas maiores de 18 anos.',
  cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
WHERE nome = 'Dra. Adriana Carla de Sena'
  AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- 2. Atualizar Dr. Pedro Francisco (reativar e corrigir dados)  
UPDATE public.medicos 
SET 
  ativo = true,
  especialidade = 'Ultrassonografista e Clínico Geral',
  idade_minima = 0,
  idade_maxima = NULL,
  convenios_aceitos = ARRAY[
    'Unimed Nacional',
    'Unimed Regional',
    'Unimed Intercâmbio', 
    'Unimed 40%',
    'Unimed 20%',
    'Medprev',
    'Particular'
  ],
  observacoes = 'Atendimentos: Consulta e Retorno. Sem idade mínima para atendimento.',
  cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
WHERE nome = 'Dr. Pedro Francisco'
  AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- 3. Criar Dr. Alessandro Dias (novo médico)
INSERT INTO public.medicos (
  nome,
  especialidade,
  idade_minima,
  idade_maxima,
  convenios_aceitos,
  observacoes,
  ativo,
  cliente_id,
  created_at
) VALUES (
  'Dr. Alessandro Dias',
  'Cardiologista',
  0,
  NULL,
  ARRAY[
    'Unimed Nacional',
    'Unimed Regional',
    'Unimed Intercâmbio',
    'Unimed 40%', 
    'Unimed 20%',
    'Particular'
  ],
  'Atendimentos: Consulta, Retorno e Ecocardiograma. Sem idade mínima para atendimento.',
  true,
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  now()
);

-- Log final
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Médicos atualizados/criados com sucesso para IPADO',
  'MEDICOS_UPDATE_COMPLETE',
  jsonb_build_object(
    'dra_adriana', 'reativada_atualizada',
    'dr_pedro', 'reativado_atualizado', 
    'dr_alessandro', 'criado',
    'cliente', 'IPADO'
  )
);

-- Verificação final - listar médicos ativos do IPADO
SELECT 
  m.nome,
  m.especialidade,
  m.idade_minima,
  m.convenios_aceitos,
  m.ativo,
  m.observacoes
FROM public.medicos m
WHERE m.cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
  AND m.ativo = true
ORDER BY m.nome;