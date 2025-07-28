-- Configurar cron job para processar batches a cada 5 segundos
SELECT cron.schedule(
  'process-message-batches-job',
  '*/5 * * * * *', -- a cada 5 segundos
  $$
  SELECT
    net.http_post(
        url:='https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/process-message-batches',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.QLeBRHFJeEqFfPjGdcY-t_gDFYd4J6Jl2eiBr4BPJRw"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);