
-- Adicionar informação sobre compatibilidade de exames no mesmo dia
INSERT INTO public.valores_procedimentos (
  categoria,
  procedimento,
  valor_principal,
  valor_unimed_coparticipacao_20,
  valor_unimed_coparticipacao_40,
  forma_pagamento,
  observacoes
) VALUES (
  'COMPATIBILIDADE_EXAMES',
  'Colonoscopia + Endoscopia no mesmo dia',
  NULL,
  NULL,
  NULL,
  'Conforme procedimento individual',
  'É possível realizar colonoscopia e endoscopia digestiva alta no mesmo dia APENAS com médicos que realizam ambos os procedimentos. Pacientes devem seguir o preparo mais restritivo (colonoscopia). Verificar disponibilidade médica antes do agendamento. Procedimento combinado oferece maior comodidade ao paciente e otimização de tempo.'
) ON CONFLICT DO NOTHING;

-- Adicionar informações detalhadas sobre localização e funcionamento da clínica
INSERT INTO public.configuracoes_clinica (
  chave,
  valor,
  categoria,
  ativo,
  dados_extras
) VALUES 
(
  'endereco_completo',
  'Praça da Bandeira, 1 - Centro, Juazeiro - BA, CEP: 48904-030',
  'localizacao',
  true,
  jsonb_build_object(
    'logradouro', 'Praça da Bandeira, 1',
    'bairro', 'Centro',
    'cidade', 'Juazeiro',
    'estado', 'BA',
    'cep', '48904-030',
    'referencias', 'Localizada no centro da cidade, próximo aos principais pontos comerciais',
    'facilidades', 'Estacionamento disponível, acesso para pessoas com mobilidade reduzida'
  )
),
(
  'horario_funcionamento',
  'Segunda a Sexta: 07:00 às 18:00 | Sábados: 07:00 às 12:00',
  'funcionamento',
  true,
  jsonb_build_object(
    'segunda_sexta', jsonb_build_object(
      'abertura', '07:00',
      'fechamento', '18:00',
      'intervalo_almoco', '12:00 às 13:00'
    ),
    'sabado', jsonb_build_object(
      'abertura', '07:00',
      'fechamento', '12:00'
    ),
    'domingo_feriados', 'Fechado',
    'observacoes', 'Atendimento mediante agendamento prévio. Horários especiais podem ser disponibilizados para casos urgentes.',
    'contato_emergencia', 'Em caso de urgência, entre em contato através dos canais oficiais da clínica'
  )
),
(
  'informacoes_acesso',
  'Clínica de fácil acesso no centro de Juazeiro-BA',
  'localizacao',
  true,
  jsonb_build_object(
    'transporte_publico', 'Próximo a pontos de ônibus das principais linhas urbanas',
    'estacionamento', 'Vagas disponíveis na própria clínica e nas proximidades',
    'acessibilidade', 'Instalações adaptadas para pessoas com deficiência ou mobilidade reduzida',
    'pontos_referencia', ARRAY['Praça da Bandeira', 'Centro Comercial', 'Banco do Brasil', 'Correios']
  )
)
ON CONFLICT (chave) DO UPDATE SET
  valor = EXCLUDED.valor,
  dados_extras = EXCLUDED.dados_extras,
  ativo = EXCLUDED.ativo;
