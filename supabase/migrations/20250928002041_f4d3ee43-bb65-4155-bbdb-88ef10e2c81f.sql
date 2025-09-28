-- Migração dos tipos MAPA - Transferir agendamentos genéricos para tipos específicos
-- Baseado nas observações dos agendamentos

-- 1. Migrar agendamentos que têm "MAPA 24H" nas observações
UPDATE agendamentos 
SET 
  atendimento_id = 'e4c36df6-e975-49ae-aa48-819ffa59eb93', -- ID do tipo "MAPA 24H"
  observacoes = CASE 
    WHEN observacoes = 'MAPA 24H' THEN NULL  -- Remove a observação se for apenas o tipo
    ELSE REPLACE(observacoes, 'MAPA 24H', '')  -- Remove o tipo da observação, mantendo o resto
  END,
  updated_at = now()
WHERE atendimento_id = 'ecab3d29-b132-4ce2-9d8c-f6dcf8fe6b45' -- ID do tipo MAPA genérico com agendamentos
  AND observacoes ILIKE '%MAPA 24H%';

-- 2. Migrar agendamentos que têm "MAPA MRPA" nas observações (se houver)
UPDATE agendamentos 
SET 
  atendimento_id = '9430ece4-b2a4-467b-b9c3-d870cfdb07d7', -- ID do tipo "MAPA MRPA"
  observacoes = CASE 
    WHEN observacoes = 'MAPA MRPA' THEN NULL  -- Remove a observação se for apenas o tipo
    ELSE REPLACE(observacoes, 'MAPA MRPA', '')  -- Remove o tipo da observação, mantendo o resto
  END,
  updated_at = now()
WHERE atendimento_id = 'ecab3d29-b132-4ce2-9d8c-f6dcf8fe6b45' -- ID do tipo MAPA genérico
  AND observacoes ILIKE '%MAPA MRPA%';

-- 3. Limpar observações vazias resultantes da migração
UPDATE agendamentos 
SET observacoes = NULL
WHERE observacoes IS NOT NULL 
  AND TRIM(observacoes) = '';

-- 4. Desativar os tipos MAPA genéricos que não são mais necessários
UPDATE atendimentos 
SET ativo = false
WHERE nome = 'MAPA' 
  AND id IN (
    'ecab3d29-b132-4ce2-9d8c-f6dcf8fe6b45',
    '0b751e41-40f2-4f6c-93a7-d5455e8c6747', 
    '2edd2cf1-b49a-4756-92e5-4c96b76d79c9',
    '8e798a37-307b-4201-8ef0-7b66572a1331'
  );

-- 5. Log da migração realizada
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context,
  data
) VALUES (
  now(),
  'info',
  'Migração dos tipos MAPA concluída',
  'MAPA_MIGRATION',
  jsonb_build_object(
    'tipos_desativados', 4,
    'agendamentos_migrados_24h', (
      SELECT COUNT(*) FROM agendamentos 
      WHERE atendimento_id = 'e4c36df6-e975-49ae-aa48-819ffa59eb93'
    ),
    'agendamentos_migrados_mrpa', (
      SELECT COUNT(*) FROM agendamentos 
      WHERE atendimento_id = '9430ece4-b2a4-467b-b9c3-d870cfdb07d7'
    )
  )
);