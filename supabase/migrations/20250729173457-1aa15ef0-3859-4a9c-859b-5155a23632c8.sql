-- Atualizar informações das médicas gastroenterologistas e hepatologistas

-- Dra. Jeovana Brandão
UPDATE public.medicos 
SET 
  convenios_aceitos = ARRAY['Unimed', 'Agenda Vale', 'Particular'],
  idade_minima = 13,
  observacoes = 'Valor da consulta particular: R$ 500,00 (espécie ou pix). Pacientes antigos com outros convênios devem verificar.'
WHERE nome = 'Dra. Jeovana Brandão';

-- Dra. Juliana Gama
UPDATE public.medicos 
SET 
  convenios_aceitos = ARRAY['Bradesco', 'Mineração Caraíba', 'Fachesf', 'Fusex', 'Postal', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'],
  idade_minima = 16,
  observacoes = 'Valor da consulta particular: R$ 500,00'
WHERE nome = 'Dra. Juliana Gama';

-- Dra. Lara Eline Menezes
UPDATE public.medicos 
SET 
  convenios_aceitos = ARRAY['Bradesco', 'Mineração Caraíba', 'Fachesf', 'Fusex', 'Postal', 'Assefaz', 'Codevasf', 'Cassi', 'Asfeb', 'Compesa', 'Casseb', 'CapSaúde', 'Particular', 'Agenda Vale', 'Medprev'],
  idade_minima = 15,
  observacoes = 'Valor da consulta particular: R$ 500,00'
WHERE nome = 'Dra. Lara Eline Menezes';

-- Dra. Luziane Sabino
UPDATE public.medicos 
SET 
  convenios_aceitos = ARRAY['Particular'],
  idade_minima = 16,
  observacoes = 'CONSULTAS: Apenas particular - R$ 500,00. EXAMES: Aceita Unimed (todos os tipos), Bradesco, Mineração Caraíba, Fachesf, Fusex, Postal, Assefaz, Codevasf, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular, Agenda Vale, Medprev'
WHERE nome = 'Dra. Luziane Sabino';