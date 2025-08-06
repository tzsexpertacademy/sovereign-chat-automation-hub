-- Limpar todos os jobs cron antigos de forma segura
DO $$
DECLARE
    job_name TEXT;
BEGIN
    -- Tentar remover jobs conhecidos, ignorando erros se não existirem
    FOR job_name IN SELECT array['process-message-batches-auto', 'process-message-batches', 'scheduler-trigger'] loop
        BEGIN
            PERFORM cron.unschedule(job_name);
            RAISE LOG 'Job % removido com sucesso', job_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Job % não encontrado ou já removido: %', job_name, SQLERRM;
        END;
    END LOOP;
END $$;

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