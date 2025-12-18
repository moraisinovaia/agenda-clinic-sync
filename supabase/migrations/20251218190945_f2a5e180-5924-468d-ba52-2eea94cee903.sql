-- =====================================================
-- CORREÇÃO BUSINESS RULES - Clínica Vênus
-- Ajustar estrutura para usar periodos.manha/tarde com dias_especificos
-- =====================================================

-- 1. ATUALIZAR Dr. João Silva - Cardiologista
-- Seg/Qua: 14h-19h (Tarde), Sex: 08h-12h (Manhã)
UPDATE business_rules
SET config = jsonb_build_object(
  'medico_nome', 'Dr. João Silva',
  'tipo_agendamento', 'hora_marcada',
  'idade_minima', 0,
  'prazo_retorno_dias', 30,
  'servicos', jsonb_build_object(
    'Consulta Cardiológica', jsonb_build_object(
      'nome', 'Consulta Cardiológica',
      'permite_online', true,
      'valor', 300,
      'periodos', jsonb_build_object(
        'tarde', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[1, 3]'::jsonb,
          'inicio', '14:00',
          'fim', '19:00',
          'limite', 10
        ),
        'manha', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[5]'::jsonb,
          'inicio', '08:00',
          'fim', '12:00',
          'limite', 8
        )
      )
    ),
    'Eletrocardiograma', jsonb_build_object(
      'nome', 'Eletrocardiograma',
      'permite_online', true,
      'valor', 150,
      'periodos', jsonb_build_object(
        'tarde', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[1, 3]'::jsonb,
          'inicio', '14:00',
          'fim', '19:00',
          'limite', 10
        ),
        'manha', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[5]'::jsonb,
          'inicio', '08:00',
          'fim', '12:00',
          'limite', 8
        )
      )
    )
  )
),
updated_at = now(),
version = version + 1
WHERE cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a'
AND medico_id = (
  SELECT id FROM medicos 
  WHERE cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a' 
  AND nome ILIKE '%João Silva%'
  LIMIT 1
);

-- 2. ATUALIZAR Dra. Gabriela Batista - Gastroenterologista  
-- Ter/Qui/Sáb: 08h-10h (ordem_chegada, atendimento 08:45), idade_minima 15
UPDATE business_rules
SET config = jsonb_build_object(
  'medico_nome', 'Dra. Gabriela Batista',
  'tipo_agendamento', 'ordem_chegada',
  'idade_minima', 15,
  'prazo_retorno_dias', 20,
  'mensagem_idade_minima', 'A Dra. Gabriela atende somente pacientes a partir de 15 anos 😊',
  'ordem_chegada_config', jsonb_build_object(
    'hora_chegada_inicio', '08:00',
    'hora_chegada_fim', '10:00',
    'hora_atendimento_inicio', '08:45',
    'mensagem', 'Compareça entre 08h e 10h. O atendimento inicia às 08:45 por ordem de chegada.'
  ),
  'servicos', jsonb_build_object(
    'Consulta Gastroenterológica', jsonb_build_object(
      'nome', 'Consulta Gastroenterológica',
      'permite_online', true,
      'valor', 280,
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[2, 4, 6]'::jsonb,
          'inicio', '08:00',
          'fim', '10:00',
          'limite', 16,
          'distribuicao_fichas', '08:00 às 10:00'
        )
      )
    ),
    'Endoscopia Digestiva Alta', jsonb_build_object(
      'nome', 'Endoscopia Digestiva Alta',
      'permite_online', true,
      'valor', 650,
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'dias_especificos', '[2, 4, 6]'::jsonb,
          'inicio', '08:00',
          'fim', '10:00',
          'limite', 16,
          'distribuicao_fichas', '08:00 às 10:00'
        )
      )
    )
  )
),
updated_at = now(),
version = version + 1
WHERE cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a'
AND medico_id = (
  SELECT id FROM medicos 
  WHERE cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a' 
  AND nome ILIKE '%Gabriela%'
  LIMIT 1
);