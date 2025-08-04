-- FASE 1: Correções de Dados dos Médicos

-- 1. Remover Colonoscopia do Dr. Edson Moreira (ele não faz)
UPDATE public.atendimentos 
SET ativo = false 
WHERE nome = 'Colonoscopia' 
  AND medico_id = '58b3d6f1-98ff-46c0-8b30-f3281dce816e';

-- 2. Corrigir Dr. Heverson Alex: remover Ecocardiograma e adicionar Teste Ergométrico
UPDATE public.atendimentos 
SET ativo = false 
WHERE nome = 'Ecocardiograma' 
  AND medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487';

-- Adicionar Teste Ergométrico para Dr. Heverson Alex
INSERT INTO public.atendimentos (nome, tipo, medico_id, medico_nome, valor_particular, forma_pagamento, ativo, observacoes)
SELECT 
  'Teste Ergométrico', 
  'exame',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  'Dr. Heverson Alex',
  150.00,
  'dinheiro/cartao',
  true,
  'Teste de esforço cardíaco'
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Teste Ergométrico' 
    AND medico_id = 'fdb7862c-e83d-4294-a36c-a61f177c9487'
);

-- 3. Corrigir Dra. Jeovana Brandão: adicionar Agenda Vale e Unimed Regional
UPDATE public.medicos 
SET convenios_aceitos = array_append(
  array_append(
    convenios_aceitos, 
    'Agenda Vale'
  ), 
  'Unimed Regional'
)
WHERE id = 'e12528a9-5b88-426f-8ef9-d0213effd886'
  AND NOT ('Agenda Vale' = ANY(convenios_aceitos) AND 'Unimed Regional' = ANY(convenios_aceitos));

-- 4. Corrigir Dra. Luziane Sabino: adicionar múltiplos convênios
UPDATE public.medicos 
SET convenios_aceitos = ARRAY[
  'Mineração', 'Bradesco', 'Unimed Nacional', 'Unimed Regional', 
  'Unimed Coparticipação 20%', 'Unimed Coparticipação 40%', 
  'Medprev', 'Agenda Vale', 'Particular'
]
WHERE id = '7902d115-4300-4fa2-8fc0-751594aa5c9c';

-- 5. Corrigir idade mínima para EEG - Dr. Fábio Drubi deve atender menores de 13 anos
UPDATE public.medicos 
SET idade_minima = 0
WHERE id = '477006ad-d1e2-47f8-940a-231f873def96';