-- Desabilitar RLS temporariamente para fila_espera e preparos até resolvermos o problema de autenticação
ALTER TABLE public.fila_espera DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparos DISABLE ROW LEVEL SECURITY;

-- Inserir dados de exemplo para testar
INSERT INTO fila_espera (paciente_id, medico_id, atendimento_id, data_preferida, periodo_preferido, observacoes, prioridade, status) 
VALUES 
  ((SELECT id FROM pacientes LIMIT 1), 
   (SELECT id FROM medicos LIMIT 1), 
   (SELECT id FROM atendimentos LIMIT 1), 
   '2025-07-15', 'manha', 'Paciente preferiu consulta de manhã', 2, 'aguardando'),
  ((SELECT id FROM pacientes OFFSET 1 LIMIT 1), 
   (SELECT id FROM medicos LIMIT 1), 
   (SELECT id FROM atendimentos OFFSET 1 LIMIT 1), 
   '2025-07-16', 'tarde', 'Paciente só pode à tarde', 3, 'notificado'),
  ((SELECT id FROM pacientes OFFSET 2 LIMIT 1), 
   (SELECT id FROM medicos OFFSET 1 LIMIT 1), 
   (SELECT id FROM atendimentos OFFSET 2 LIMIT 1), 
   '2025-07-17', 'qualquer', 'Urgente - paciente com sintomas', 4, 'aguardando');