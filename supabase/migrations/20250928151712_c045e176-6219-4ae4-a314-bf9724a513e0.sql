-- Primeiro, vamos inativar o atendimento MAPA atual que está inativo
UPDATE public.atendimentos 
SET ativo = false, 
    observacoes = 'Substituído por MAPA 24H e MAPA MRPA'
WHERE medico_id = 'e6453b94-840d-4adf-ab0f-fc22be7cd7f5' 
  AND nome = 'MAPA'
  AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

-- Inserir os dois novos tipos de MAPA para o Dr. Marcelo
INSERT INTO public.atendimentos (
  medico_id,
  nome,
  tipo,
  ativo,
  cliente_id,
  observacoes,
  created_at
) VALUES 
(
  'e6453b94-840d-4adf-ab0f-fc22be7cd7f5',
  'MAPA 24H',
  'Exame',
  true,
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'Monitorização Ambulatorial da Pressão Arterial de 24 horas',
  now()
),
(
  'e6453b94-840d-4adf-ab0f-fc22be7cd7f5',
  'MAPA MRPA',
  'Exame', 
  true,
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'Monitorização Residencial da Pressão Arterial',
  now()
);