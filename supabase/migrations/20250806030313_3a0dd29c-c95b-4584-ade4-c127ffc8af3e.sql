-- Configurar cron job reduzido para 5 minutos (apenas backup)
-- Remover jobs antigos
SELECT cron.unschedule('process-message-batches-auto');
SELECT cron.unschedule('process-message-batches');

-- Criar novo job backup a cada 5 minutos
SELECT cron.schedule(
  'process-message-batches-backup',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/scheduler-trigger',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY"}'::jsonb,
    body := '{"trigger": "backup_scheduler", "mode": "cleanup_and_recovery"}'::jsonb
  );
  $$
);

-- Configurar variáveis para as funções RPC
ALTER DATABASE postgres SET app.supabase_url = 'https://ymygyagbvbsdfkduxmgu.supabase.co';
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY';