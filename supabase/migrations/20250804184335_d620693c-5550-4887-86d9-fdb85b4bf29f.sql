-- Adicionar Retossigmoidoscopia para os médicos que fazem colonoscopia
-- Dr. Sydney Ribeiro, Dra. Juliana Gama e Dra. Lara Eline Menezes

INSERT INTO public.atendimentos (
  nome,
  tipo,
  codigo,
  medico_id,
  medico_nome,
  valor_particular,
  coparticipacao_unimed_20,
  coparticipacao_unimed_40,
  forma_pagamento,
  observacoes,
  ativo
) VALUES
-- Retossigmoidoscopia para Dr. Sydney Ribeiro
(
  'Retossigmoidoscopia',
  'procedimento_especial',
  'RETOSSIGMO_SYDNEY',
  '5617c20f-5f3d-4e1f-924c-e624a6b8852b',
  'Dr. Sydney Ribeiro',
  500.00,
  50.00,
  100.00,
  'Dinheiro/PIX/Cartão/Convênio',
  'Exame endoscópico do reto e sigmóide - Dr. Sydney',
  true
),
-- Retossigmoidoscopia para Dra. Juliana Gama
(
  'Retossigmoidoscopia',
  'procedimento_especial',
  'RETOSSIGMO_JULIANA',
  'efc2ec87-21dd-4e10-b327-50d83df7daac',
  'Dra. Juliana Gama',
  500.00,
  50.00,
  100.00,
  'Dinheiro/PIX/Cartão/Convênio',
  'Exame endoscópico do reto e sigmóide - Dra. Juliana',
  true
),
-- Retossigmoidoscopia para Dra. Lara Eline Menezes
(
  'Retossigmoidoscopia',
  'procedimento_especial',
  'RETOSSIGMO_LARA',
  '3dd16059-102a-4626-a2ac-2517f0e5c195',
  'Dra. Lara Eline Menezes',
  500.00,
  50.00,
  100.00,
  'Dinheiro/PIX/Cartão/Convênio',
  'Exame endoscópico do reto e sigmóide - Dra. Lara',
  true
);