-- CORREÇÃO DEFINITIVA: Voltar para 1 minuto + SERVICE_ROLE_KEY
-- Resolver bombardeamento do sistema

-- 1. LIMPAR TODOS os jobs conflitantes
SELECT cron.unschedule('process-message-batches-auto');
SELECT cron.unschedule('process-message-batches');
SELECT cron.unschedule(6);
SELECT cron.unschedule(8);

-- 2. RECRIAR job correto: 1 MINUTO + SERVICE_ROLE_KEY
SELECT cron.schedule(
  'process-batches-1min',
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

-- 3. VERIFICAÇÃO: Deve ter apenas 2 jobs ativos
SELECT 
  jobid,
  jobname,
  schedule,
  'CORRIGIDO - 1 MIN + SERVICE_ROLE' as status
FROM cron.job 
WHERE active = true 
ORDER BY jobid;