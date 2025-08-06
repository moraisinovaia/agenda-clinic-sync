-- 1. Atualizar convênios do Dr. Carlos
UPDATE public.medicos 
SET convenios_aceitos = ARRAY['SUS', 'Unimed', 'Óticas', 'Medprev', 'Semaryprev', 'AgendaVale']
WHERE nome = 'Dr. Carlos';

-- 2. Criar atendimento "Polipectomia do Cólon" se não existir
INSERT INTO public.atendimentos (nome, tipo, ativo)
SELECT 'Polipectomia do Cólon', 'procedimento', true
WHERE NOT EXISTS (SELECT 1 FROM public.atendimentos WHERE nome = 'Polipectomia do Cólon');

-- 3. Criar atendimento "Polipectomia Gástrica" se não existir
INSERT INTO public.atendimentos (nome, tipo, ativo)
SELECT 'Polipectomia Gástrica', 'procedimento', true
WHERE NOT EXISTS (SELECT 1 FROM public.atendimentos WHERE nome = 'Polipectomia Gástrica');

-- 4. Associar "Polipectomia do Cólon" aos médicos específicos (Dr. Sydney, Dra. Lara, Dra. Juliana)
INSERT INTO public.atendimentos (nome, tipo, ativo, medico_id)
SELECT 'Polipectomia do Cólon', 'procedimento', true, m.id
FROM public.medicos m
WHERE m.nome IN ('Dr. Sydney', 'Dra. Lara', 'Dra. Juliana')
AND NOT EXISTS (
  SELECT 1 FROM public.atendimentos a 
  WHERE a.nome = 'Polipectomia do Cólon' AND a.medico_id = m.id
);

-- 5. Associar "Polipectomia Gástrica" a todos os gastroenterologistas
INSERT INTO public.atendimentos (nome, tipo, ativo, medico_id)
SELECT 'Polipectomia Gástrica', 'procedimento', true, m.id
FROM public.medicos m
WHERE m.especialidade ILIKE '%gastro%'
AND NOT EXISTS (
  SELECT 1 FROM public.atendimentos a 
  WHERE a.nome = 'Polipectomia Gástrica' AND a.medico_id = m.id
);