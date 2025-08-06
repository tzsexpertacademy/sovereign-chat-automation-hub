-- Corrigir assignment de assistente no ticket atual
UPDATE conversation_tickets 
SET assigned_assistant_id = '367dc746-c174-4b64-a5fe-697972f65746' 
WHERE id = '26e572cf-c476-4f2a-939e-539db0e2dee1';

-- Resetar batches travados
UPDATE message_batches 
SET processing_started_at = NULL, processing_by = NULL 
WHERE processing_started_at IS NOT NULL 
AND processing_started_at < NOW() - INTERVAL '30 seconds';