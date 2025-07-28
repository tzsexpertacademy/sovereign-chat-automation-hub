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

-- Marcar mensagens não processadas para reprocessamento (corrigindo o ORDER BY)
UPDATE public.whatsapp_messages 
SET is_processed = false, 
    processed_at = NULL,
    processing_started_at = NULL
WHERE is_processed = false 
AND instance_id = '01K11NBE1QB0GVFMME8NA4YPCB'
AND chat_id = '554796451886@s.whatsapp.net';