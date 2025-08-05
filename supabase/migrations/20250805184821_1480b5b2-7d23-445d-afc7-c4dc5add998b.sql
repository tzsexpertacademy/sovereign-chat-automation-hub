-- CONSOLIDAÇÃO INTELIGENTE DOS JOBS - VERSÃO DEFENSIVA
-- Apenas remover conflitos e criar job limpo

-- 1. REMOVER JOB 7 (process-message-batches-fast) se existir
DO $$
BEGIN
    PERFORM cron.unschedule('process-message-batches-fast');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job process-message-batches-fast não encontrado ou já removido';
END $$;

-- 2. REMOVER JOB 6 se ainda existir
DO $$
BEGIN
    PERFORM cron.unschedule('process-message-batches');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Job process-message-batches não encontrado ou já removido';
END $$;

-- 3. CRIAR NOVO JOB 6 LIMPO - a cada 5 segundos
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

-- 4. VERIFICAÇÃO FINAL
SELECT 
  'CONSOLIDAÇÃO CONCLUÍDA:' as status,
  COUNT(*) as jobs_ativos
FROM cron.job 
WHERE active = true;

-- Lista final de jobs
SELECT 
  jobid,
  jobname, 
  schedule,
  active
FROM cron.job 
WHERE active = true 
ORDER BY jobid;