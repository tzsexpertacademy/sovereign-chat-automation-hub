-- Remover jobs antigos de processamento de batches
SELECT cron.unschedule('process-message-batches-auto');
SELECT cron.unschedule('process-message-batches');

-- Criar job otimizado executando a cada 5 segundos
SELECT cron.schedule(
  'process-message-batches-fast',
  '*/5 * * * * *', -- A cada 5 segundos
  $$
  SELECT net.http_post(
    url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/scheduler-trigger',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.VQcVlNJEkpGRgL-p9eHKOPDgZ1jlVtmJQLLv0xSc5Bw"}'::jsonb,
    body := '{"trigger": "cron", "frequency": "5s"}'::jsonb
  );
  $$
);