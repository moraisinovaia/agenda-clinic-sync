-- Corrigir os médicos que não têm atendimentos vinculados
-- Vamos criar atendimentos básicos para os médicos de cardiologia

-- Primeiro, vamos criar atendimentos para Dr. Diego Tomás
INSERT INTO atendimentos (nome, tipo, medico_id, ativo, valor_particular, forma_pagamento)
VALUES 
  ('Consulta Cardiologia', 'consulta', '04505052-89c5-4090-9921-806a6fc7b544', true, 200.00, 'dinheiro/cartao'),
  ('ECG', 'exame', '04505052-89c5-4090-9921-806a6fc7b544', true, 120.00, 'dinheiro/cartao'),
  ('Ecocardiograma', 'exame', '04505052-89c5-4090-9921-806a6fc7b544', true, 300.00, 'dinheiro/cartao');

-- Atendimentos para Dr. Heverson Alex
INSERT INTO atendimentos (nome, tipo, medico_id, ativo, valor_particular, forma_pagamento)
VALUES 
  ('Consulta Cardiologia', 'consulta', 'fdb7862c-e83d-4294-a36c-a61f177c9487', true, 200.00, 'dinheiro/cartao'),
  ('ECG', 'exame', 'fdb7862c-e83d-4294-a36c-a61f177c9487', true, 120.00, 'dinheiro/cartao'),
  ('Ecocardiograma', 'exame', 'fdb7862c-e83d-4294-a36c-a61f177c9487', true, 300.00, 'dinheiro/cartao');

-- Atendimentos para Dr. Max Koki
INSERT INTO atendimentos (nome, tipo, medico_id, ativo, valor_particular, forma_pagamento)
VALUES 
  ('Consulta Cardiologia', 'consulta', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', true, 200.00, 'dinheiro/cartao'),
  ('ECG', 'exame', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', true, 120.00, 'dinheiro/cartao'),
  ('Ecocardiograma', 'exame', '84f434dc-21f6-41a9-962e-9b0722a0e2d4', true, 300.00, 'dinheiro/cartao');