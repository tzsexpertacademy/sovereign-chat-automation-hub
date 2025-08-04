-- Correção emergencial: adicionar coluna processing_started_at na message_batches se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'message_batches' 
        AND column_name = 'processing_started_at'
    ) THEN
        ALTER TABLE public.message_batches 
        ADD COLUMN processing_started_at timestamp with time zone;
    END IF;
END $$;

-- Marcar todas as mensagens não processadas desde 20:00 para reprocessamento
UPDATE public.whatsapp_messages 
SET is_processed = false, processed_at = NULL
WHERE created_at >= '2025-08-04 20:00:00'
AND (is_processed = true OR is_processed IS NULL);

-- Limpar batches órfãos e recriar estrutura
DELETE FROM public.message_batches 
WHERE created_at >= '2025-08-04 20:00:00';

-- Inserir logs para debug
INSERT INTO public.system_logs (level, message, metadata) 
VALUES ('info', 'Sistema de processamento de mensagens reiniciado', 
        '{"timestamp": "2025-08-04T21:19:00Z", "action": "emergency_fix"}'::jsonb);