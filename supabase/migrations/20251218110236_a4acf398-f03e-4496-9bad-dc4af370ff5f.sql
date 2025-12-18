-- Criar atendimento diferenciado para a agenda separada "Teste Ergométrico - Dr. Marcelo"
INSERT INTO public.atendimentos (
  cliente_id,
  medico_id,
  medico_nome,
  nome,
  tipo,
  ativo
)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',  -- IPADO
  '9d5d0e63-098b-4282-aa03-db3c7e012579',  -- Teste Ergométrico - Dr. Marcelo (agenda separada)
  'Teste Ergométrico - Dr. Marcelo',
  'Teste Ergom. (Agenda Separada)',        -- Nome diferenciado para evitar conflito
  'exame',
  true
);