-- CORREÇÃO DEFINITIVA: Job específico para processamento de mídia
-- Remover jobs antigos conflitantes
SELECT cron.unschedule('process-media-decryption') WHERE exists (SELECT 1 FROM cron.job WHERE jobname = 'process-media-decryption');

-- Criar job específico para descriptografia de mídia (a cada 30 segundos)
SELECT cron.schedule(
  'process-media-decryption',
  '*/30 * * * * *', -- A cada 30 segundos
  $$
  SELECT
    net.http_post(
        url:='https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/process-received-media',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.TkRJLdZl0Q_M8kSVG9WtJVIaJqz0HLdQ_BOlUxDhsrM"}'::jsonb,
        body:=concat('{"trigger": "media_processing", "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Função para monitorar estatísticas de processamento de áudio
CREATE OR REPLACE FUNCTION public.get_audio_processing_stats(p_client_id UUID)
RETURNS TABLE(
  total_audio_messages BIGINT,
  processed_audio BIGINT,
  pending_decryption BIGINT,
  pending_transcription BIGINT,
  orphaned_audio BIGINT,
  processing_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH audio_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN audio_base64 IS NOT NULL THEN 1 END) as with_base64,
      COUNT(CASE WHEN processing_status = 'received' AND media_key IS NOT NULL THEN 1 END) as pending_decrypt,
      COUNT(CASE WHEN audio_base64 IS NOT NULL AND (media_transcription IS NULL OR media_transcription = '') THEN 1 END) as pending_transcript,
      COUNT(CASE WHEN created_at < NOW() - INTERVAL '10 minutes' AND processing_status = 'received' THEN 1 END) as orphaned
    FROM ticket_messages tm
    JOIN conversation_tickets ct ON tm.ticket_id = ct.id
    WHERE ct.client_id = p_client_id 
      AND tm.message_type IN ('audio', 'ptt')
      AND tm.created_at >= NOW() - INTERVAL '24 hours'
  )
  SELECT 
    total,
    with_base64,
    pending_decrypt,
    pending_transcript,
    orphaned,
    CASE WHEN total > 0 THEN ROUND((with_base64::NUMERIC / total::NUMERIC) * 100, 2) ELSE 0 END
  FROM audio_stats;
END;
$$;

-- Função para reprocessar áudios órfãos
CREATE OR REPLACE FUNCTION public.reprocess_orphaned_audio(p_client_id UUID)
RETURNS TABLE(
  reprocessed_count INTEGER,
  error_count INTEGER,
  message_ids TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reprocessed INTEGER := 0;
  v_errors INTEGER := 0;
  v_message_ids TEXT[] := '{}';
  v_message RECORD;
BEGIN
  -- Buscar áudios órfãos (mais de 5 minutos sem processamento)
  FOR v_message IN 
    SELECT tm.id, tm.message_id, tm.ticket_id
    FROM ticket_messages tm
    JOIN conversation_tickets ct ON tm.ticket_id = ct.id
    WHERE ct.client_id = p_client_id
      AND tm.message_type IN ('audio', 'ptt')
      AND tm.processing_status = 'received'
      AND tm.media_key IS NOT NULL
      AND tm.created_at < NOW() - INTERVAL '5 minutes'
    ORDER BY tm.created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Resetar status para reprocessamento
      UPDATE ticket_messages 
      SET 
        processing_status = 'received',
        updated_at = NOW()
      WHERE id = v_message.id;
      
      v_reprocessed := v_reprocessed + 1;
      v_message_ids := array_append(v_message_ids, v_message.message_id);
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_reprocessed, v_errors, v_message_ids;
END;
$$;