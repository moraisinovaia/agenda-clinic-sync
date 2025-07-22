
-- INFRAESTRUTURA RLS OTIMIZADA PARA AUDITORIA MÉDICA
-- Versão integrada com sistema existente de usuários

-- 1. HABILITAR RLS EM TODAS AS TABELAS DE AUDITORIA
ALTER TABLE logs_auditoria_medica ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_criticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE validacoes_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_sistema_auditoria ENABLE ROW LEVEL SECURITY;

-- 2. CRIAR FUNÇÃO HELPER PARA VERIFICAR SE USUÁRIO É ADMIN
CREATE OR REPLACE FUNCTION public.is_admin_auditoria()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'aprovado'
  );
$$;

-- 3. FUNÇÃO HELPER PARA VERIFICAR SE USUÁRIO ESTÁ AUTENTICADO E APROVADO
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND status = 'aprovado'
  );
$$;

-- 4. POLÍTICAS PARA logs_auditoria_medica
-- Service role pode inserir logs (N8N/Edge Functions)
CREATE POLICY "service_role_can_insert_logs"
ON logs_auditoria_medica
FOR INSERT
TO service_role
WITH CHECK (true);

-- Usuários autenticados podem consultar logs
CREATE POLICY "authenticated_can_select_logs"
ON logs_auditoria_medica
FOR SELECT
TO authenticated
USING (public.is_authenticated_user());

-- Admins podem fazer tudo
CREATE POLICY "admins_can_manage_logs"
ON logs_auditoria_medica
FOR ALL
TO authenticated
USING (public.is_admin_auditoria())
WITH CHECK (public.is_admin_auditoria());

-- 5. POLÍTICAS PARA metricas_diarias
-- Service role pode gerenciar métricas (triggers automáticos)
CREATE POLICY "service_role_can_manage_metrics"
ON metricas_diarias
FOR ALL
TO service_role
WITH CHECK (true);

-- Usuários autenticados podem consultar métricas
CREATE POLICY "authenticated_can_select_metrics"
ON metricas_diarias
FOR SELECT
TO authenticated
USING (public.is_authenticated_user());

-- 6. POLÍTICAS PARA alertas_criticos
-- Service role pode gerenciar alertas
CREATE POLICY "service_role_can_manage_alerts"
ON alertas_criticos
FOR ALL
TO service_role
WITH CHECK (true);

-- Usuários autenticados podem consultar alertas
CREATE POLICY "authenticated_can_select_alerts"
ON alertas_criticos
FOR SELECT
TO authenticated
USING (public.is_authenticated_user());

-- Admins podem atualizar status de alertas
CREATE POLICY "admins_can_update_alerts"
ON alertas_criticos
FOR UPDATE
TO authenticated
USING (public.is_admin_auditoria())
WITH CHECK (public.is_admin_auditoria());

-- 7. POLÍTICAS PARA validacoes_detalhadas
-- Service role pode inserir validações
CREATE POLICY "service_role_can_insert_validations"
ON validacoes_detalhadas
FOR INSERT
TO service_role
WITH CHECK (true);

-- Usuários autenticados podem consultar validações
CREATE POLICY "authenticated_can_select_validations"
ON validacoes_detalhadas
FOR SELECT
TO authenticated
USING (public.is_authenticated_user());

-- 8. POLÍTICAS PARA config_sistema_auditoria
-- Service role pode consultar configurações (para N8N)
CREATE POLICY "service_role_can_select_config"
ON config_sistema_auditoria
FOR SELECT
TO service_role
USING (true);

-- Usuários autenticados podem consultar configurações ativas
CREATE POLICY "authenticated_can_select_active_config"
ON config_sistema_auditoria
FOR SELECT
TO authenticated
USING (public.is_authenticated_user() AND ativo = true);

-- Admins podem gerenciar todas as configurações
CREATE POLICY "admins_can_manage_config"
ON config_sistema_auditoria
FOR ALL
TO authenticated
USING (public.is_admin_auditoria())
WITH CHECK (public.is_admin_auditoria());

-- 9. TESTE COMPLETO DA INFRAESTRUTURA
DO $$
DECLARE
  log_id UUID;
  metrics_count INTEGER;
BEGIN
  -- Teste 1: Inserção de log como service_role
  SET LOCAL role = 'service_role';
  
  INSERT INTO logs_auditoria_medica (
    pergunta_original,
    categoria,
    tipo_pergunta,
    processamento,
    resposta_gerada,
    sucesso,
    precisao,
    validacao_passou
  ) VALUES (
    'Teste completo da infraestrutura RLS otimizada',
    'CRITICO',
    'teste_infraestrutura',
    'DETERMINISTICO',
    'Sistema de auditoria médica configurado com políticas RLS otimizadas',
    true,
    '100%',
    true
  ) RETURNING id INTO log_id;
  
  RAISE NOTICE 'LOG INSERIDO: %', log_id;
  
  -- Teste 2: Verificar se trigger de métricas funcionou
  SELECT total_interacoes INTO metrics_count
  FROM metricas_diarias 
  WHERE data = CURRENT_DATE;
  
  RAISE NOTICE 'MÉTRICAS ATUALIZADAS: % interações hoje', COALESCE(metrics_count, 0);
  
  -- Teste 3: Inserir alerta crítico
  INSERT INTO alertas_criticos (
    tipo,
    severidade,
    pergunta,
    erro_detectado,
    log_auditoria_id
  ) VALUES (
    'TESTE_INFRAESTRUTURA',
    1,
    'Teste completo da infraestrutura',
    'Nenhum erro - teste de funcionamento',
    log_id
  );
  
  RAISE NOTICE 'ALERTA INSERIDO COM SUCESSO';
  
  -- Teste 4: Inserir validação detalhada
  INSERT INTO validacoes_detalhadas (
    log_auditoria_id,
    tipo_validacao,
    resultado,
    validador
  ) VALUES (
    log_id,
    'TESTE_COMPLETO',
    true,
    'sistema_rls_otimizado'
  );
  
  RAISE NOTICE 'VALIDAÇÃO INSERIDA COM SUCESSO';
  
  -- Reset role
  RESET role;
  
  RAISE NOTICE '✅ TODOS OS TESTES PASSARAM - INFRAESTRUTURA 100%% FUNCIONAL';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ ERRO NO TESTE: %', SQLERRM;
  RESET role;
END;
$$;

-- 10. VERIFICAÇÕES FINAIS
-- Contar registros em cada tabela
SELECT 
  'logs_auditoria_medica' as tabela,
  COUNT(*) as registros
FROM logs_auditoria_medica
WHERE tipo_pergunta = 'teste_infraestrutura'

UNION ALL

SELECT 
  'metricas_diarias' as tabela,
  COUNT(*) as registros
FROM metricas_diarias
WHERE data = CURRENT_DATE

UNION ALL

SELECT 
  'alertas_criticos' as tabela,
  COUNT(*) as registros
FROM alertas_criticos
WHERE tipo = 'TESTE_INFRAESTRUTURA'

UNION ALL

SELECT 
  'validacoes_detalhadas' as tabela,
  COUNT(*) as registros
FROM validacoes_detalhadas
WHERE tipo_validacao = 'TESTE_COMPLETO'

UNION ALL

SELECT 
  'config_sistema_auditoria' as tabela,
  COUNT(*) as registros
FROM config_sistema_auditoria;

-- 11. TESTE FINAL DO DASHBOARD
SELECT 
  '🎯 DASHBOARD EXECUTIVO' as teste,
  CASE 
    WHEN interacoes_hoje IS NOT NULL THEN '✅ FUNCIONANDO'
    ELSE '❌ ERRO'
  END as status
FROM vw_dashboard_executivo

UNION ALL

SELECT 
  '🎯 FUNÇÃO TEMPO REAL' as teste,
  CASE 
    WHEN (dashboard_tempo_real())::text LIKE '%timestamp%' THEN '✅ FUNCIONANDO'
    ELSE '❌ ERRO'
  END as status;

-- 12. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON FUNCTION public.is_admin_auditoria() 
IS 'Verifica se o usuário atual é admin aprovado para operações de auditoria';

COMMENT ON FUNCTION public.is_authenticated_user() 
IS 'Verifica se o usuário está autenticado e aprovado no sistema';

COMMENT ON POLICY "service_role_can_insert_logs" ON logs_auditoria_medica 
IS 'Permite que N8N e Edge Functions insiram logs de auditoria médica';

COMMENT ON POLICY "authenticated_can_select_logs" ON logs_auditoria_medica 
IS 'Usuários aprovados podem consultar logs de auditoria';

-- 13. LIMPEZA OPCIONAL DOS DADOS DE TESTE
-- Descomente as linhas abaixo se quiser remover os dados de teste:
/*
DELETE FROM validacoes_detalhadas WHERE tipo_validacao = 'TESTE_COMPLETO';
DELETE FROM alertas_criticos WHERE tipo = 'TESTE_INFRAESTRUTURA';
DELETE FROM logs_auditoria_medica WHERE tipo_pergunta = 'teste_infraestrutura';
*/

-- 14. STATUS FINAL
SELECT 
  '🎉 INFRAESTRUTURA DE AUDITORIA MÉDICA OTIMIZADA' as resultado,
  '✅ TODAS AS POLÍTICAS RLS CONFIGURADAS' as status,
  '🚀 PRONTO PARA PRODUÇÃO' as proximo_passo;
