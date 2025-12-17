-- FASE 4: OTIMIZAÇÃO DE LOGS

-- Limpar logs antigos (manter últimos 30 dias)
DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '30 days';

-- Criar função de limpeza automática de logs
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retention_days INTEGER := 30;
  deleted_count INTEGER;
BEGIN
  DELETE FROM system_logs 
  WHERE created_at < (NOW() - (retention_days || ' days')::INTERVAL);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log da limpeza (se deletou alguma coisa)
  IF deleted_count > 0 THEN
    INSERT INTO system_logs (timestamp, level, message, context, data)
    VALUES (
      NOW(), 'info',
      FORMAT('[SYSTEM] Limpeza de logs executada: %s registros removidos', deleted_count),
      'LOG_CLEANUP',
      jsonb_build_object('deleted_count', deleted_count, 'retention_days', retention_days)
    );
  END IF;
END;
$$;

-- Verificar e limpar notification_logs se vazio
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM notification_logs) = 0 THEN
    -- Tabela vazia, pode ser mantida mas está limpa
    RAISE NOTICE 'notification_logs está vazia - mantendo estrutura';
  END IF;
END $$;