-- CONSOLIDAÇÃO INTELIGENTE DOS JOBS
-- Estratégia: Corrigir Job 6 e remover Job 7 conflitante

-- 1. REMOVER JOB 7 (process-message-batches-fast) - redundante
SELECT cron.unschedule('process-message-batches-fast');

-- 2. REMOVER JOB 6 ATUAL (malformado) 
SELECT cron.unschedule('process-message-batches');

-- 3. RECRIAR JOB 6 CORRIGIDO - a cada 5 segundos
SELECT cron.schedule(
  'process-message-batches',
  '*/5 * * * * *', -- a cada 5 segundos
  $$
  select
    net.http_post(
        url:='https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/scheduler-trigger',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI"}'::jsonb,
        body:=concat('{"trigger": "cron", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- 4. VERIFICAÇÃO FINAL - apenas jobs limpos devem aparecer
SELECT 
  'CONSOLIDAÇÃO CONCLUÍDA - Status dos jobs:' as resultado,
  COUNT(*) as total_jobs_ativos
FROM cron.job 
WHERE active = true;

-- Listar jobs finais (deve ter apenas 2: heartbeat + scheduler)
SELECT 
  jobid,
  jobname, 
  schedule,
  command,
  'ATIVO' as status
FROM cron.job 
WHERE active = true 
ORDER BY jobid;