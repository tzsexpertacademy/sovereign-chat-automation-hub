-- CORREÇÃO SIMPLIFICADA: Apenas resetar sistema e garantir job único
-- Sem tentar remover jobs que não existem

-- 1. RESETAR MENSAGENS TRAVADAS (mais de 3 minutos em processamento)
UPDATE public.message_batches 
SET 
  processing_started_at = NULL,
  processing_by = NULL,
  last_updated = NOW()
WHERE processing_started_at IS NOT NULL 
  AND processing_started_at < NOW() - INTERVAL '3 minutes';

-- 2. CRIAR BATCHES EMERGENCIAIS para mensagens não processadas
WITH mensagens_pendentes AS (
  SELECT 
    wm.chat_id,
    wm.client_id,
    wm.instance_id,
    jsonb_agg(
      jsonb_build_object(
        'messageId', wm.message_id,
        'chatId', wm.chat_id,
        'content', wm.body,
        'fromMe', wm.from_me,
        'timestamp', EXTRACT(EPOCH FROM wm.timestamp) * 1000,
        'pushName', wm.sender
      ) ORDER BY wm.timestamp
    ) as messages_array,
    MIN(wm.created_at) as first_message_at
  FROM public.whatsapp_messages wm
  WHERE wm.is_processed = false
    AND wm.created_at >= NOW() - INTERVAL '2 hours'  -- Apenas mensagens recentes
    AND NOT wm.from_me  -- Apenas mensagens recebidas
  GROUP BY wm.chat_id, wm.client_id, wm.instance_id
)
INSERT INTO public.message_batches (chat_id, client_id, instance_id, messages, created_at)
SELECT 
  chat_id,
  client_id,
  instance_id,
  messages_array,
  first_message_at
FROM mensagens_pendentes
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_batches mb 
  WHERE mb.chat_id = mensagens_pendentes.chat_id 
  AND mb.processing_started_at IS NULL
)
ON CONFLICT DO NOTHING;

-- 3. MARCAR mensagens como processadas para evitar duplicação futura
UPDATE public.whatsapp_messages 
SET is_processed = true, processed_at = NOW()
WHERE is_processed = false
  AND created_at >= NOW() - INTERVAL '2 hours'
  AND NOT from_me;

-- 4. GARANTIR que apenas o job correto existe
-- Remover job se existir
SELECT cron.unschedule('process-batches-1min-fixed') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-batches-1min-fixed');

-- Criar job único definitivo
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

-- 5. FUNÇÃO de monitoramento para prevenir duplicações futuras
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_jobs integer;
  v_pending_batches integer;
  v_unprocessed_messages integer;
  v_stuck_batches integer;
BEGIN
  -- Contar jobs ativos
  SELECT COUNT(*) INTO v_total_jobs FROM cron.job WHERE active = true;
  
  -- Contar batches pendentes
  SELECT COUNT(*) INTO v_pending_batches 
  FROM public.message_batches 
  WHERE processing_started_at IS NULL;
  
  -- Contar mensagens não processadas
  SELECT COUNT(*) INTO v_unprocessed_messages 
  FROM public.whatsapp_messages 
  WHERE is_processed = false;
  
  -- Contar batches travados
  SELECT COUNT(*) INTO v_stuck_batches
  FROM public.message_batches 
  WHERE processing_started_at IS NOT NULL 
    AND processing_started_at < NOW() - INTERVAL '5 minutes';
  
  RETURN jsonb_build_object(
    'total_jobs', v_total_jobs,
    'pending_batches', v_pending_batches,
    'unprocessed_messages', v_unprocessed_messages,
    'stuck_batches', v_stuck_batches,
    'system_healthy', (v_total_jobs = 2 AND v_stuck_batches = 0),
    'timestamp', NOW()
  );
END;
$$;

-- 6. VERIFICAÇÃO FINAL: mostrar estado atual
SELECT 
  jobid,
  jobname,
  schedule,
  CASE 
    WHEN jobname LIKE '%process%' THEN '🤖 PROCESSAMENTO'
    WHEN jobname LIKE '%heartbeat%' THEN '💓 HEARTBEAT'
    ELSE '❓ OUTRO'
  END as categoria,
  'SISTEMA CORRIGIDO - VERSÃO SIMPLES' as status
FROM cron.job 
WHERE active = true 
ORDER BY jobid;

-- 7. Relatório de recuperação
SELECT 
  'ESTATÍSTICAS DE RECUPERAÇÃO' as evento,
  (SELECT COUNT(*) FROM public.message_batches WHERE created_at >= NOW() - INTERVAL '5 minutes') as batches_criados_recentemente,
  (SELECT COUNT(*) FROM public.whatsapp_messages WHERE is_processed = true AND processed_at >= NOW() - INTERVAL '5 minutes') as mensagens_marcadas_processadas,
  NOW() as timestamp;