-- Configurar cron job para backup automático
SELECT cron.schedule(
  'auto-backup-job',
  '0 * * * *', -- A cada hora
  $$
  SELECT net.http_post(
    url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/auto-backup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.zLEXy9fFUGHGEUvJ8nxJtOa5vl0xb7eWrKfOVHBr7UY"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);

-- Função para verificar status do cron job (corrigida)
CREATE OR REPLACE FUNCTION public.get_backup_cron_status()
RETURNS TABLE(
  job_name text,
  schedule text,
  active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    jobname::text,
    schedule::text,
    active
  FROM cron.job 
  WHERE jobname = 'auto-backup-job';
$function$;

-- Função para habilitar/desabilitar cron job
CREATE OR REPLACE FUNCTION public.toggle_backup_cron(enable_cron boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF enable_cron THEN
    -- Habilitar o job
    UPDATE cron.job 
    SET active = true 
    WHERE jobname = 'auto-backup-job';
    
    -- Se o job não existe, criar
    IF NOT FOUND THEN
      PERFORM cron.schedule(
        'auto-backup-job',
        '0 * * * *',
        $$
        SELECT net.http_post(
          url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/auto-backup',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.zLEXy9fFUGHGEUvJ8nxJtOa5vl0xb7eWrKfOVHBr7UY"}'::jsonb,
          body := '{"scheduled": true}'::jsonb
        ) as request_id;
        $$
      );
    END IF;
  ELSE
    -- Desabilitar o job
    UPDATE cron.job 
    SET active = false 
    WHERE jobname = 'auto-backup-job';
  END IF;
  
  RETURN enable_cron;
END;
$function$;