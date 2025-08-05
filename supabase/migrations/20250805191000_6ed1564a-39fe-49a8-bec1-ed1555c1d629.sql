-- CORREÇÃO DEFINITIVA: Eliminar Job 6 + Reprocessar Mensagens Travadas
-- Abordagem robusta para resolver conflitos de processamento

-- 1. FUNÇÃO para remover job por ID (mais direto)
CREATE OR REPLACE FUNCTION force_remove_job_by_id(job_id integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    DELETE FROM cron.job WHERE jobid = job_id;
    RAISE LOG 'Job ID % removido com sucesso', job_id;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Erro ao remover Job ID %: %', job_id, SQLERRM;
    RETURN false;
  END;
END;
$$;

-- 2. LIMPEZA FORÇADA de todos os jobs problemáticos
-- Remover por nome primeiro
SELECT cron.unschedule('process-message-batches') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-message-batches');
SELECT cron.unschedule('process-message-batches-auto') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-message-batches-auto');

-- Remover Job 6 diretamente por ID se ainda existir
SELECT force_remove_job_by_id(6) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobid = 6);

-- 3. RESETAR MENSAGENS TRAVADAS (mais de 5 minutos em processamento)
UPDATE public.message_batches 
SET 
  processing_started_at = NULL,
  processing_by = NULL,
  last_updated = NOW()
WHERE processing_started_at IS NOT NULL 
  AND processing_started_at < NOW() - INTERVAL '5 minutes';

-- 4. RECRIAR BATCHES para mensagens não processadas (emergência)
INSERT INTO public.message_batches (chat_id, client_id, instance_id, messages, created_at)
SELECT 
  wm.chat_id,
  wm.client_id,
  wm.instance_id,
  jsonb_build_array(
    jsonb_build_object(
      'messageId', wm.message_id,
      'chatId', wm.chat_id,
      'content', wm.body,
      'fromMe', wm.from_me,
      'timestamp', EXTRACT(EPOCH FROM wm.timestamp) * 1000,
      'pushName', wm.sender
    )
  ) as messages,
  wm.created_at
FROM public.whatsapp_messages wm
WHERE wm.is_processed = false
  AND wm.created_at >= NOW() - INTERVAL '2 hours'  -- Apenas mensagens recentes
  AND NOT wm.from_me  -- Apenas mensagens recebidas
  AND NOT EXISTS (
    SELECT 1 FROM public.message_batches mb 
    WHERE mb.chat_id = wm.chat_id 
    AND mb.processing_started_at IS NULL
  )
ON CONFLICT DO NOTHING;

-- 5. MARCAR mensagens como processadas para evitar duplicação
UPDATE public.whatsapp_messages 
SET is_processed = true, processed_at = NOW()
WHERE is_processed = false
  AND created_at >= NOW() - INTERVAL '2 hours'
  AND NOT from_me;

-- 6. GARANTIR que apenas o job correto existe
-- Remover job antigo se existir
SELECT cron.unschedule('process-batches-1min-fixed') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-batches-1min-fixed');

-- Recriar job único e definitivo
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

-- 7. FUNÇÃO de monitoramento anti-duplicação
CREATE OR REPLACE FUNCTION detect_duplicate_jobs()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_duplicates jsonb;
  v_total_jobs integer;
BEGIN
  -- Contar jobs duplicados
  SELECT jsonb_agg(
    jsonb_build_object(
      'jobname', jobname,
      'count', job_count,
      'jobids', job_ids
    )
  ) INTO v_duplicates
  FROM (
    SELECT 
      jobname,
      COUNT(*) as job_count,
      array_agg(jobid) as job_ids
    FROM cron.job 
    WHERE active = true
    GROUP BY jobname
    HAVING COUNT(*) > 1
  ) duplicates;
  
  SELECT COUNT(*) INTO v_total_jobs FROM cron.job WHERE active = true;
  
  RETURN jsonb_build_object(
    'total_active_jobs', v_total_jobs,
    'duplicate_jobs', COALESCE(v_duplicates, '[]'::jsonb),
    'has_duplicates', (v_duplicates IS NOT NULL),
    'timestamp', NOW()
  );
END;
$$;

-- 8. VERIFICAÇÃO FINAL e relatório
SELECT 
  jobid,
  jobname,
  schedule,
  CASE 
    WHEN jobname LIKE '%process%' THEN '🤖 PROCESSAMENTO'
    WHEN jobname LIKE '%heartbeat%' THEN '💓 HEARTBEAT'
    ELSE '❓ OUTRO'
  END as categoria,
  'SISTEMA CORRIGIDO' as status
FROM cron.job 
WHERE active = true 
ORDER BY jobid;

-- 9. Estatísticas de recuperação
SELECT 
  'MENSAGENS RECUPERADAS' as evento,
  COUNT(*) as total_batches_criados,
  NOW() as timestamp
FROM public.message_batches 
WHERE created_at >= NOW() - INTERVAL '1 minute';

-- 10. LIMPAR função auxiliar
DROP FUNCTION force_remove_job_by_id(integer);