-- Criar cron job para executar o processamento de batches automaticamente
SELECT cron.schedule(
  'process-message-batches-auto',
  '*/10 * * * * *', -- A cada 10 segundos
  $$
  SELECT
    net.http_post(
        url:='https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/scheduler-trigger',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.qJXOmqPkLLVoWlPklIGa3qAGDg6LLjhqDsKzKojGLXQ"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '", "type": "scheduled"}')::jsonb
    ) as request_id;
  $$
);