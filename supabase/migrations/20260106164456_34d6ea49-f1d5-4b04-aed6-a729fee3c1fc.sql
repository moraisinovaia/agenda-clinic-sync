-- Cadastrar Taxas de Gastroenterologia para todos os médicos que fazem colonoscopia

-- Taxa de Soro (R$ 80) para gastros que não têm
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, medico_id, ativo)
VALUES
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa de Soro', 'taxa', 80.00, 'efc2ec87-21dd-4e10-b327-50d83df7daac', true), -- Dra. Juliana Gama
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa de Soro', 'taxa', 80.00, '3dd16059-102a-4626-a2ac-2517f0e5c195', true), -- Dra. Lara Eline Menezes
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa de Soro', 'taxa', 80.00, '8f59fe17-4bf9-4134-b7aa-626249966776', true), -- Dr. Darcy Muritiba
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa de Soro', 'taxa', 80.00, '58b3d6f1-98ff-46c0-8b30-f3281dce816e', true), -- Dr. Edson Moreira
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa de Soro', 'taxa', 80.00, '7902d115-4300-4fa2-8fc0-751594aa5c9c', true); -- Dra. Luziane Sabino

-- Taxa Polipectomia Particular (R$ 600) para gastros que não têm
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, medico_id, ativo)
VALUES
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Particular', 'taxa', 600.00, 'efc2ec87-21dd-4e10-b327-50d83df7daac', true), -- Dra. Juliana Gama
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Particular', 'taxa', 600.00, '3dd16059-102a-4626-a2ac-2517f0e5c195', true), -- Dra. Lara Eline Menezes
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Particular', 'taxa', 600.00, '8f59fe17-4bf9-4134-b7aa-626249966776', true), -- Dr. Darcy Muritiba
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Particular', 'taxa', 600.00, '58b3d6f1-98ff-46c0-8b30-f3281dce816e', true), -- Dr. Edson Moreira
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Particular', 'taxa', 600.00, '7902d115-4300-4fa2-8fc0-751594aa5c9c', true); -- Dra. Luziane Sabino

-- Taxa Polipectomia Vale Saúde (R$ 500) para todos os gastros
INSERT INTO atendimentos (cliente_id, nome, tipo, valor_particular, medico_id, observacoes, ativo)
VALUES
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Vale Saúde', 'taxa', 500.00, '5617c20f-5f3d-4e1f-924c-e624a6b8852b', 'Agenda Vale', true), -- Dr. Sydney Ribeiro
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Vale Saúde', 'taxa', 500.00, 'efc2ec87-21dd-4e10-b327-50d83df7daac', 'Agenda Vale', true), -- Dra. Juliana Gama
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Vale Saúde', 'taxa', 500.00, '3dd16059-102a-4626-a2ac-2517f0e5c195', 'Agenda Vale', true), -- Dra. Lara Eline Menezes
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Vale Saúde', 'taxa', 500.00, '8f59fe17-4bf9-4134-b7aa-626249966776', 'Agenda Vale', true), -- Dr. Darcy Muritiba
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Vale Saúde', 'taxa', 500.00, '58b3d6f1-98ff-46c0-8b30-f3281dce816e', 'Agenda Vale', true), -- Dr. Edson Moreira
  ('39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Taxa Polipectomia Vale Saúde', 'taxa', 500.00, '7902d115-4300-4fa2-8fc0-751594aa5c9c', 'Agenda Vale', true); -- Dra. Luziane Sabino

-- Corrigir valor da taxa existente (de R$ 600 para R$ 500)
UPDATE atendimentos 
SET valor_particular = 500.00 
WHERE id = '14978093-ad23-4a42-b4d4-adc0aab86ec7';