-- Migração para Clínica Vênus
-- 1. Renomear clínica
UPDATE public.clientes 
SET nome = 'Clínica Vênus',
    updated_at = now()
WHERE id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a';

-- 2. Atualizar convênios dos médicos existentes da clínica
UPDATE public.medicos 
SET convenios_aceitos = ARRAY['PARTICULAR', 'UNIMED 40%', 'UNIMED 20%', 'UNIMED REGIONAL', 'UNIMED INTERCAMBIO', 'UNIMED NACIONAL']
WHERE cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a';

-- 3. Inserir atendimentos/serviços para a clínica
-- Consulta Cardiológica (Dr. João Silva)
INSERT INTO public.atendimentos (cliente_id, nome, tipo, medico_id, medico_nome, valor_particular, ativo, observacoes)
VALUES (
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a',
  'Consulta Cardiológica',
  'consulta',
  '25440cf9-7832-4034-9e2a-9d8ee9b4d12d',
  'Dr. João Silva',
  300.00,
  true,
  'Consulta por hora marcada. Retorno gratuito em até 30 dias.'
)
ON CONFLICT DO NOTHING;

-- Eletrocardiograma (Dr. João Silva)
INSERT INTO public.atendimentos (cliente_id, nome, tipo, medico_id, medico_nome, valor_particular, ativo, observacoes)
VALUES (
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a',
  'Eletrocardiograma',
  'exame',
  '25440cf9-7832-4034-9e2a-9d8ee9b4d12d',
  'Dr. João Silva',
  150.00,
  true,
  'ECG realizado pelo Dr. João Silva'
)
ON CONFLICT DO NOTHING;

-- Consulta Gastroenterológica (Dra. Gabriela Batista)
INSERT INTO public.atendimentos (cliente_id, nome, tipo, medico_id, medico_nome, valor_particular, ativo, observacoes)
VALUES (
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a',
  'Consulta Gastroenterológica',
  'consulta',
  '4361d620-4c9b-4602-aab1-e835cc63c8a2',
  'Dra. Gabriela Batista',
  280.00,
  true,
  'Atendimento por ordem de chegada. Retorno gratuito em até 20 dias.'
)
ON CONFLICT DO NOTHING;

-- Endoscopia Digestiva Alta (Dra. Gabriela Batista)
INSERT INTO public.atendimentos (cliente_id, nome, tipo, medico_id, medico_nome, valor_particular, ativo, observacoes)
VALUES (
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a',
  'Endoscopia Digestiva Alta',
  'exame',
  '4361d620-4c9b-4602-aab1-e835cc63c8a2',
  'Dra. Gabriela Batista',
  500.00,
  true,
  'Exame por ordem de chegada. Requer preparo específico.'
)
ON CONFLICT DO NOTHING;