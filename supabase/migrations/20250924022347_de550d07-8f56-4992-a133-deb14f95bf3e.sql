-- Correção da separação de médicos com tratamento de foreign keys

-- 1. Primeiro, criar uma estratégia de mapeamento entre médicos antigos e novos
-- Vamos assumir que médicos com o mesmo nome são os mesmos

-- 2. Backup de segurança
CREATE TABLE IF NOT EXISTS temp_medicos_backup AS 
SELECT * FROM public.medicos;

-- 3. Identificar médicos que são duplicados (antigos vs novos)
CREATE TEMP TABLE medicos_duplicados AS
SELECT 
    m_atual.id as medico_atual_id,
    m_atual.nome,
    em.medico_id_original as medico_antigo_id,
    m_atual.created_at as data_criacao_atual
FROM public.medicos m_atual
JOIN public.endogastro_medicos em ON m_atual.nome = em.nome 
WHERE m_atual.cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1)
AND em.cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1);

-- 4. Para médicos duplicados, manter apenas o mais recente e atualizar referências
-- Atualizar referências na tabela atendimentos
UPDATE public.atendimentos 
SET medico_id = (
    SELECT medico_atual_id 
    FROM medicos_duplicados md 
    WHERE md.medico_antigo_id = atendimentos.medico_id
)
WHERE medico_id IN (
    SELECT medico_antigo_id FROM medicos_duplicados
);

-- 5. Agora podemos remover os médicos antigos duplicados da tabela medicos
DELETE FROM public.medicos 
WHERE id IN (
    SELECT m.id 
    FROM public.medicos m
    JOIN public.endogastro_medicos em ON m.nome = em.nome
    WHERE m.cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1)
    AND em.cliente_id = (SELECT id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1)
    AND m.created_at < '2024-01-01'  -- Assumindo que médicos criados antes de 2024 são antigos
);

-- 6. Log da operação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Correção da separação de médicos com tratamento de foreign keys',
  'MEDICOS_SEPARATION_FIX_V2',
  jsonb_build_object(
    'action', 'updated_references_and_removed_old_doctors',
    'backup_table', 'temp_medicos_backup'
  )
);

-- 7. Verificar resultado final
DO $$
DECLARE
  medicos_count INTEGER;
  endogastro_count INTEGER;
  atendimentos_refs INTEGER;
BEGIN
  SELECT COUNT(*) INTO medicos_count FROM public.medicos;
  SELECT COUNT(*) INTO endogastro_count FROM public.endogastro_medicos;
  SELECT COUNT(DISTINCT medico_id) INTO atendimentos_refs FROM public.atendimentos;
  
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Resultado final da separação de médicos',
    'MEDICOS_SEPARATION_RESULT_V2',
    jsonb_build_object(
      'medicos_atuais', medicos_count,
      'medicos_historicos', endogastro_count,
      'medicos_referenciados_atendimentos', atendimentos_refs
    )
  );
END $$;