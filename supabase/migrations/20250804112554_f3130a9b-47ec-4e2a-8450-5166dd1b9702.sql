-- Atualizar preços dos cardiologistas
-- Consulta particular: 280,00 reais
-- Consulta + ECG (Parecer cardiológico): 350,00 reais  
-- Só ECG: 80,00 reais

-- Atualizar consultas de cardiologia para 280,00
UPDATE public.atendimentos 
SET valor_particular = 280.00
WHERE nome = 'Consulta Cardiologia' 
AND medico_id IN (
  SELECT id FROM public.medicos WHERE especialidade = 'Cardiologia'
);

-- Atualizar ECG para 80,00
UPDATE public.atendimentos 
SET valor_particular = 80.00
WHERE nome = 'ECG'
AND medico_id IN (
  SELECT id FROM public.medicos WHERE especialidade = 'Cardiologia'
);

-- Criar atendimento "Parecer Cardiológico" (Consulta + ECG) por 350,00 para os cardiologistas
INSERT INTO public.atendimentos (nome, tipo, medico_id, medico_nome, valor_particular, forma_pagamento, ativo, observacoes)
SELECT 
  'Parecer Cardiológico', 
  'exame',
  m.id,
  m.nome,
  350.00,
  'dinheiro/cartao',
  true,
  'Consulta + ECG combinados'
FROM public.medicos m 
WHERE m.especialidade = 'Cardiologia'
ON CONFLICT (nome, medico_id) DO UPDATE SET
  valor_particular = 350.00,
  observacoes = 'Consulta + ECG combinados';