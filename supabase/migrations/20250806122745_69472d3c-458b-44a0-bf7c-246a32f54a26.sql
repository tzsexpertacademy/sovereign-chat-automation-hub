-- 🧹 LIMPEZA MAIS SIMPLES: Apenas deletar tabela e funções obsoletas

-- 1. Deletar tabela de message_batches
DROP TABLE IF EXISTS public.message_batches CASCADE;

-- 2. Deletar funções de batch obsoletas
DROP FUNCTION IF EXISTS public.manage_message_batch(text, uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.manage_message_batch_v2(text, uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.manage_message_batch_immediate(text, uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.schedule_immediate_batch_processing(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_orphaned_batches() CASCADE;

-- 3. Atualizar whatsapp_messages para marcar todas como processadas (evitar órfãs)
UPDATE public.whatsapp_messages 
SET is_processed = true, processed_at = NOW() 
WHERE is_processed = false;