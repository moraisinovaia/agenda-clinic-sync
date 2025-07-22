-- DIA 1: VIEWS DE CONSULTA RÁPIDA PARA O DASHBOARD (CORRIGIDO)
-- Execute após criar as tabelas de auditoria

-- 1. VIEW DASHBOARD EXECUTIVO
CREATE OR REPLACE VIEW vw_dashboard_executivo AS
SELECT 
  -- Métricas do dia atual
  COALESCE(m_hoje.total_interacoes, 0) as interacoes_hoje,
  COALESCE(m_hoje.taxa_sucesso, 100) as taxa_sucesso_hoje,
  COALESCE(m_hoje.alertas_gerados, 0) as alertas_hoje,
  
  -- Métricas da semana
  COALESCE(semana.total_semana, 0) as interacoes_semana,
  COALESCE(semana.taxa_semana, 100) as taxa_sucesso_semana,
  
  -- Métricas do mês
  COALESCE(mes.total_mes, 0) as interacoes_mes,
  COALESCE(mes.taxa_mes, 100) as taxa_sucesso_mes,
  
  -- Status geral
  CASE 
    WHEN COALESCE(m_hoje.alertas_criticos, 0) > 0 THEN 'CRÍTICO'
    WHEN COALESCE(m_hoje.erros, 0) > 0 THEN 'ATENÇÃO'
    ELSE 'OK'
  END as status_sistema,
  
  -- Última atualização
  NOW() as ultima_atualizacao

FROM metricas_diarias m_hoje
FULL OUTER JOIN (
  SELECT 
    SUM(total_interacoes) as total_semana,
    AVG(taxa_sucesso) as taxa_semana
  FROM metricas_diarias 
  WHERE data >= CURRENT_DATE - INTERVAL '7 days'
) semana ON true
FULL OUTER JOIN (
  SELECT 
    SUM(total_interacoes) as total_mes,
    AVG(taxa_sucesso) as taxa_mes
  FROM metricas_diarias 
  WHERE data >= CURRENT_DATE - INTERVAL '30 days'
) mes ON true
WHERE m_hoje.data = CURRENT_DATE OR m_hoje.data IS NULL;

-- 2. VIEW ALERTAS ATIVOS
CREATE OR REPLACE VIEW vw_alertas_ativos AS
SELECT 
  a.id,
  a.timestamp,
  a.tipo,
  a.severidade,
  CASE a.severidade
    WHEN 1 THEN 'BAIXA'
    WHEN 2 THEN 'MÉDIA'
    WHEN 3 THEN 'ALTA'
    WHEN 4 THEN 'CRÍTICA'
    WHEN 5 THEN 'EMERGÊNCIA'
  END as severidade_desc,
  a.pergunta,
  a.erro_detectado,
  a.usuario_afetado,
  a.notificado,
  EXTRACT(EPOCH FROM (NOW() - a.timestamp))/60 as minutos_desde_criacao,
  l.categoria as categoria_original,
  l.tipo_pergunta
FROM alertas_criticos a
LEFT JOIN logs_auditoria_medica l ON a.log_auditoria_id = l.id
WHERE a.resolvido = false
ORDER BY a.severidade DESC, a.timestamp DESC;

-- 3. VIEW PERFORMANCE DETALHADA (CORRIGIDA)
CREATE OR REPLACE VIEW vw_performance_sistema AS
SELECT 
  DATE(l.timestamp) as data,
  l.categoria,
  l.tipo_pergunta,
  COUNT(*) as total_perguntas,
  COUNT(*) FILTER (WHERE l.sucesso = true) as sucessos,
  COUNT(*) FILTER (WHERE l.sucesso = false) as erros,
  ROUND((COUNT(*) FILTER (WHERE l.sucesso = true)::DECIMAL / COUNT(*)) * 100, 2) as taxa_sucesso,
  
  -- Validações
  COUNT(*) FILTER (WHERE l.validacao_passou = true) as validacoes_ok,
  COUNT(*) FILTER (WHERE l.validacao_passou = false) as validacoes_falha,
  
  -- Alertas gerados
  COUNT(a.id) as alertas_gerados
  
FROM logs_auditoria_medica l
LEFT JOIN alertas_criticos a ON a.log_auditoria_id = l.id
WHERE l.timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(l.timestamp), l.categoria, l.tipo_pergunta
ORDER BY data DESC, l.categoria, l.tipo_pergunta;

-- 4. VIEW AUDITORIA CRÍTICA
CREATE OR REPLACE VIEW vw_auditoria_critica AS
SELECT 
  l.id,
  l.timestamp,
  l.pergunta_original,
  l.resposta_gerada,
  l.categoria,
  l.tipo_pergunta,
  l.sucesso,
  l.validacao_passou,
  l.erros_detectados,
  l.usuario_telefone,
  l.hash_resposta,
  
  -- Detalhes de validação
  array_agg(
    DISTINCT v.tipo_validacao || ': ' || 
    CASE WHEN v.resultado THEN 'OK' ELSE 'FALHA - ' || COALESCE(v.erro_detalhado, 'Erro não especificado') END
  ) FILTER (WHERE v.tipo_validacao IS NOT NULL) as validacoes_detalhes,
  
  -- Alertas relacionados
  COUNT(a.id) as alertas_relacionados,
  
  -- Status de revisão
  CASE 
    WHEN l.requer_revisao AND l.revisado_em IS NULL THEN 'PENDENTE REVISÃO'
    WHEN l.requer_revisao AND l.revisado_em IS NOT NULL THEN 'REVISADO'
    WHEN NOT l.sucesso THEN 'REQUER ATENÇÃO'
    ELSE 'OK'
  END as status_revisao

FROM logs_auditoria_medica l
LEFT JOIN validacoes_detalhadas v ON v.log_auditoria_id = l.id
LEFT JOIN alertas_criticos a ON a.log_auditoria_id = l.id
WHERE l.categoria = 'CRITICO'
  AND l.timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY l.id, l.timestamp, l.pergunta_original, l.resposta_gerada, 
         l.categoria, l.tipo_pergunta, l.sucesso, l.validacao_passou,
         l.erros_detectados, l.usuario_telefone, l.hash_resposta,
         l.requer_revisao, l.revisado_em
ORDER BY l.timestamp DESC;

-- 5. VIEW MÉTRICAS POR CONVÊNIO
CREATE OR REPLACE VIEW vw_metricas_convenios AS
WITH convenios_perguntados AS (
  SELECT 
    DATE(l.timestamp) as data,
    CASE 
      WHEN l.pergunta_original ILIKE '%medprev%' THEN 'Medprev'
      WHEN l.pergunta_original ILIKE '%unimed%' THEN 'Unimed'
      WHEN l.pergunta_original ILIKE '%bradesco%' THEN 'Bradesco'
      WHEN l.pergunta_original ILIKE '%particular%' THEN 'Particular'
      WHEN l.pergunta_original ILIKE '%mineração%' THEN 'Mineração'
      WHEN l.pergunta_original ILIKE '%fusex%' THEN 'Fusex'
      ELSE 'Outros'
    END as convenio,
    COUNT(*) as total_perguntas,
    COUNT(*) FILTER (WHERE l.sucesso = true) as respostas_corretas,
    COUNT(*) FILTER (WHERE l.resposta_gerada ILIKE '%nenhum médico%') as sem_medicos_encontrados,
    COUNT(*) FILTER (WHERE l.resposta_gerada ILIKE '%Dr.%') as com_medicos_encontrados
  FROM logs_auditoria_medica l
  WHERE l.tipo_pergunta = 'convenios'
    AND l.timestamp >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(l.timestamp), convenio
)
SELECT 
  convenio,
  SUM(total_perguntas) as total_perguntas_mes,
  SUM(respostas_corretas) as total_corretas,
  SUM(sem_medicos_encontrados) as total_sem_medicos,
  SUM(com_medicos_encontrados) as total_com_medicos,
  ROUND((SUM(respostas_corretas)::DECIMAL / SUM(total_perguntas)) * 100, 2) as taxa_acerto,
  ROUND((SUM(sem_medicos_encontrados)::DECIMAL / SUM(total_perguntas)) * 100, 2) as perc_sem_medicos
FROM convenios_perguntados
GROUP BY convenio
ORDER BY total_perguntas_mes DESC;

-- 6. VIEW RELATÓRIO GERENCIAL
CREATE OR REPLACE VIEW vw_relatorio_gerencial AS
SELECT 
  'Última 24 horas' as periodo,
  COUNT(*) as total_interacoes,
  COUNT(*) FILTER (WHERE categoria = 'CRITICO') as interacoes_criticas,
  COUNT(*) FILTER (WHERE categoria = 'INFORMATIVO') as interacoes_informativas,
  COUNT(*) FILTER (WHERE categoria = 'CONVERSACIONAL') as interacoes_conversacionais,
  
  -- Precisão por categoria
  ROUND((COUNT(*) FILTER (WHERE categoria = 'CRITICO' AND sucesso = true)::DECIMAL / 
         NULLIF(COUNT(*) FILTER (WHERE categoria = 'CRITICO'), 0)) * 100, 2) as precisao_critica,
  ROUND((COUNT(*) FILTER (WHERE categoria = 'INFORMATIVO' AND sucesso = true)::DECIMAL / 
         NULLIF(COUNT(*) FILTER (WHERE categoria = 'INFORMATIVO'), 0)) * 100, 2) as precisao_informativa,
  
  -- Tipos de pergunta mais frequentes
  mode() WITHIN GROUP (ORDER BY tipo_pergunta) as tipo_mais_frequente,
  
  -- Alertas
  (SELECT COUNT(*) FROM alertas_criticos WHERE timestamp >= NOW() - INTERVAL '24 hours') as alertas_24h,
  (SELECT COUNT(*) FROM alertas_criticos WHERE timestamp >= NOW() - INTERVAL '24 hours' AND resolvido = false) as alertas_pendentes,
  
  -- Status geral
  CASE 
    WHEN (SELECT COUNT(*) FROM alertas_criticos WHERE timestamp >= NOW() - INTERVAL '24 hours' AND severidade >= 4) > 0 THEN 'CRÍTICO'
    WHEN COUNT(*) FILTER (WHERE sucesso = false AND categoria = 'CRITICO') > 0 THEN 'ATENÇÃO'
    ELSE 'OPERACIONAL'
  END as status_geral

FROM logs_auditoria_medica
WHERE timestamp >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Últimos 7 dias' as periodo,
  COUNT(*) as total_interacoes,
  COUNT(*) FILTER (WHERE categoria = 'CRITICO') as interacoes_criticas,
  COUNT(*) FILTER (WHERE categoria = 'INFORMATIVO') as interacoes_informativas,
  COUNT(*) FILTER (WHERE categoria = 'CONVERSACIONAL') as interacoes_conversacionais,
  
  ROUND((COUNT(*) FILTER (WHERE categoria = 'CRITICO' AND sucesso = true)::DECIMAL / 
         NULLIF(COUNT(*) FILTER (WHERE categoria = 'CRITICO'), 0)) * 100, 2) as precisao_critica,
  ROUND((COUNT(*) FILTER (WHERE categoria = 'INFORMATIVO' AND sucesso = true)::DECIMAL / 
         NULLIF(COUNT(*) FILTER (WHERE categoria = 'INFORMATIVO'), 0)) * 100, 2) as precisao_informativa,
  
  mode() WITHIN GROUP (ORDER BY tipo_pergunta) as tipo_mais_frequente,
  
  (SELECT COUNT(*) FROM alertas_criticos WHERE timestamp >= NOW() - INTERVAL '7 days') as alertas_24h,
  (SELECT COUNT(*) FROM alertas_criticos WHERE timestamp >= NOW() - INTERVAL '7 days' AND resolvido = false) as alertas_pendentes,
  
  CASE 
    WHEN (SELECT COUNT(*) FROM alertas_criticos WHERE timestamp >= NOW() - INTERVAL '7 days' AND severidade >= 4) > 0 THEN 'CRÍTICO'
    WHEN COUNT(*) FILTER (WHERE sucesso = false AND categoria = 'CRITICO') > 0 THEN 'ATENÇÃO'
    ELSE 'OPERACIONAL'
  END as status_geral

FROM logs_auditoria_medica
WHERE timestamp >= NOW() - INTERVAL '7 days';

-- 7. FUNÇÃO PARA DASHBOARD EM TEMPO REAL
CREATE OR REPLACE FUNCTION dashboard_tempo_real()
RETURNS JSON AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_build_object(
    'timestamp', NOW(),
    'metricas_hoje', (
      SELECT json_build_object(
        'total_interacoes', COALESCE(total_interacoes, 0),
        'taxa_sucesso', COALESCE(taxa_sucesso, 100),
        'alertas_ativos', COALESCE(alertas_gerados, 0)
      )
      FROM metricas_diarias 
      WHERE data = CURRENT_DATE
    ),
    'alertas_criticos', (
      SELECT json_agg(
        json_build_object(
          'tipo', tipo,
          'severidade', severidade,
          'minutos_ago', minutos_desde_criacao,
          'usuario', usuario_afetado
        )
      )
      FROM vw_alertas_ativos
      WHERE severidade >= 3
      LIMIT 5
    ),
    'ultima_interacao', (
      SELECT json_build_object(
        'timestamp', timestamp,
        'categoria', categoria,
        'sucesso', sucesso,
        'tipo', tipo_pergunta
      )
      FROM logs_auditoria_medica
      ORDER BY timestamp DESC
      LIMIT 1
    ),
    'status_sistema', (
      SELECT status_sistema
      FROM vw_dashboard_executivo
    )
  ) INTO resultado;
  
  RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- COMENTÁRIOS
COMMENT ON VIEW vw_dashboard_executivo IS 'Dashboard executivo com métricas principais';
COMMENT ON VIEW vw_alertas_ativos IS 'Alertas ativos que requerem atenção';
COMMENT ON VIEW vw_performance_sistema IS 'Performance detalhada do sistema por período';
COMMENT ON VIEW vw_auditoria_critica IS 'Auditoria específica para perguntas críticas';
COMMENT ON VIEW vw_metricas_convenios IS 'Métricas específicas por convênio consultado';
COMMENT ON VIEW vw_relatorio_gerencial IS 'Relatório gerencial para gestão da clínica';

SELECT 'Views de consulta rápida criadas com sucesso!' as status;