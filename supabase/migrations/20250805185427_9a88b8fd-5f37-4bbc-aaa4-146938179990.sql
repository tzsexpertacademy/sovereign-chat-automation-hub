-- CORREÇÃO ROBUSTA: Voltar para 1 minuto + SERVICE_ROLE_KEY
-- Tratamento seguro de jobs que podem ou não existir

-- 1. FUNÇÃO para remover job seguramente (se existir)
CREATE OR REPLACE FUNCTION safe_unschedule_job(job_name_or_id text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    PERFORM cron.unschedule(job_name_or_id);
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Job % não encontrado para remoção: %', job_name_or_id, SQLERRM;
    RETURN false;
  END;
END;
$$;

-- 2. LIMPEZA SEGURA de todos os jobs problemáticos
SELECT safe_unschedule_job('process-message-batches-auto');
SELECT safe_unschedule_job('process-message-batches');
SELECT safe_unschedule_job('6');
SELECT safe_unschedule_job('8');

-- 3. RECRIAR job correto: 1 MINUTO + SERVICE_ROLE_KEY
SELECT cron.schedule(
  'process-batches-1min-fixed',
  '* * * * *', -- A cada 1 minuto
  $$
  SELECT
    net.http_post(
      url:='https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/process-message-batches',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.I7wgsLb9PpI6qO2nR4qg4fhzHWhSJOK8jdVo0A2a0nY"}'::jsonb,
      body:='{"trigger": "scheduler"}'::jsonb
    ) as request_id;
  $$
);

-- 4. VERIFICAÇÃO final
SELECT 
  jobid,
  jobname,
  schedule,
  'SISTEMA CORRIGIDO - 1MIN + SERVICE_ROLE' as status
FROM cron.job 
WHERE active = true 
ORDER BY jobid;

-- 5. REMOVER função auxiliar
DROP FUNCTION safe_unschedule_job(text);