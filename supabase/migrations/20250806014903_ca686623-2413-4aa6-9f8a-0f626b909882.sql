-- 1. Atualizar convênios do Dr. Carlos
UPDATE public.medicos 
SET convenios_aceitos = ARRAY['SUS', 'Unimed', 'Óticas', 'Medprev', 'Semaryprev', 'AgendaVale']
WHERE nome = 'Dr. Carlos';

-- 2. Criar atendimento "Polipectomia do Cólon" se não existir
INSERT INTO public.atendimentos (nome, tipo, ativo)
VALUES ('Polipectomia do Cólon', 'procedimento', true)
ON CONFLICT (nome) DO NOTHING;

-- 3. Criar atendimento "Polipectomia Gástrica" se não existir
INSERT INTO public.atendimentos (nome, tipo, ativo)
VALUES ('Polipectomia Gástrica', 'procedimento', true)
ON CONFLICT (nome) DO NOTHING;

-- 4. Associar "Polipectomia do Cólon" aos médicos específicos
UPDATE public.atendimentos 
SET medico_id = (SELECT id FROM public.medicos WHERE nome = 'Dr. Sydney' LIMIT 1)
WHERE nome = 'Polipectomia do Cólon';

-- Duplicar para Dra. Lara
INSERT INTO public.atendimentos (nome, tipo, ativo, medico_id)
SELECT 'Polipectomia do Cólon', 'procedimento', true, id
FROM public.medicos 
WHERE nome = 'Dra. Lara'
ON CONFLICT DO NOTHING;

-- Duplicar para Dra. Juliana
INSERT INTO public.atendimentos (nome, tipo, ativo, medico_id)
SELECT 'Polipectomia do Cólon', 'procedimento', true, id
FROM public.medicos 
WHERE nome = 'Dra. Juliana'
ON CONFLICT DO NOTHING;

-- 5. Associar "Polipectomia Gástrica" a todos os gastroenterologistas
INSERT INTO public.atendimentos (nome, tipo, ativo, medico_id)
SELECT 'Polipectomia Gástrica', 'procedimento', true, id
FROM public.medicos 
WHERE especialidade ILIKE '%gastro%'
ON CONFLICT DO NOTHING;