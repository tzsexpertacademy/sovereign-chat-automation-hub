-- Limpar batches órfãos e problemas na constraint
DELETE FROM public.message_batches 
WHERE processing_started_at IS NOT NULL 
AND processing_started_at < now() - interval '5 minutes';

-- Remover constraint problemática temporariamente se existir
ALTER TABLE public.message_batches 
DROP CONSTRAINT IF EXISTS idx_message_batches_unique_active;

-- Recriar index único mais flexível
DROP INDEX IF EXISTS idx_message_batches_chat_processing;
CREATE UNIQUE INDEX idx_message_batches_unique_active 
ON public.message_batches (client_id, chat_id, instance_id) 
WHERE processing_started_at IS NULL;

-- Forçar reprocessamento das mensagens pendentes através de trigger no process-message-batches
-- Marcar mensagens não processadas para reprocessamento
UPDATE public.whatsapp_messages 
SET is_processed = false, 
    processed_at = NULL,
    processing_started_at = NULL
WHERE is_processed = false 
AND message_id IN (
  SELECT DISTINCT message_id 
  FROM public.whatsapp_messages 
  WHERE instance_id = '01K11NBE1QB0GVFMME8NA4YPCB'
  AND chat_id = '554796451886@s.whatsapp.net'
  AND is_processed = false
  ORDER BY timestamp DESC 
  LIMIT 10
);