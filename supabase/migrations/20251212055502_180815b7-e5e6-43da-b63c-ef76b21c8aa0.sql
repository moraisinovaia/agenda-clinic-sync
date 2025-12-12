-- Atualizar Dr. Sydney Ribeiro
UPDATE medicos 
SET 
  convenios_aceitos = ARRAY[
    'BRADESCO', 'POSTAL', 'MINERAÇÃO', 'FACHESF', 'FUSEX', 
    'CAMED', 'ASSEFAZ', 'CODEVASF', 'CASSIC', 'CASSI', 
    'ASFEB', 'COMPESA', 'CASSEB', 'CAPSAÚDE', 'PARTICULAR',
    'UNIMED NACIONAL', 'UNIMED REGIONAL', 
    'UNIMED COPARTICIPAÇÃO 40%', 'UNIMED COPARTICIPAÇÃO 20%', 
    'UNIMED INTERCÂMBIO'
  ],
  observacoes = 'Fachesf nº 43 NÃO atende. Idades mín: Consulta 12 anos | EDA 13 anos | Colono 15 anos. Pagamento particular: espécie, PIX ou 2x cartão. Realiza: Colonoscopia, Musectomia, Ligadura, Polipectomia, Dilatação, Balão Intragástrico. COLONO +60 anos: 09:30 marcação, triagem pela enfermeira. Internados: verificar prontuário antes. Taxa soro R$80 + taxa pólipo.'
WHERE id = '5617c20f-5f3d-4e1f-924c-e624a6b8852b';

-- Atualizar Dra. Lara Eline Menezes
UPDATE medicos 
SET 
  idade_minima = 18,
  idade_maxima = 65,
  observacoes = 'Valor consulta particular: R$500,00. COLONOSCOPIA: somente 18 a 65 anos. -18 anos: contato com a clínica. Autorização: pedir guia e carteirinha quando necessário. Taxa soro R$80,00 + taxa pólipo.'
WHERE id = '3dd16059-102a-4626-a2ac-2517f0e5c195';

-- Atualizar Dra. Juliana Gama
UPDATE medicos 
SET 
  idade_minima = 18,
  observacoes = 'Valor consulta particular: R$500,00. COLONOSCOPIA: a partir de 18 anos. +59 anos: pré-agendamento + triagem enfermeira. Sexta: 1 paciente 09:00 (colonoscopia). -18 anos: contato com a clínica. Autorização: guia e carteirinha quando necessário. Taxa soro R$80,00 + taxa pólipo.'
WHERE id = 'efc2ec87-21dd-4e10-b327-50d83df7daac';