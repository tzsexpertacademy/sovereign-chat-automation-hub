-- Marcar mensagens pendentes como não processadas para reprocessamento
UPDATE public.whatsapp_messages 
SET is_processed = false 
WHERE chat_id = '554796451886@s.whatsapp.net' 
AND created_at > '2025-08-04 20:58:00'
AND is_processed = true;