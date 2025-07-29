-- Criar cron job para executar heartbeat de status online a cada 2 minutos
SELECT cron.schedule(
  'heartbeat-online-status',
  '*/2 * * * *', -- A cada 2 minutos
  $$
  SELECT
    net.http_post(
        url:='https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/scheduled-heartbeat',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NTQxNjksImV4cCI6MjA2NjAzMDE2OX0.DNbFrX49olS0EtLFe8aj-hBakaY5e9EJE6Qoy7hYjCI"}'::jsonb,
        body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);