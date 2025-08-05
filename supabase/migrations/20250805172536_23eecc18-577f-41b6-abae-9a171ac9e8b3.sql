-- Resetar o batch que estava travado para reprocessamento
UPDATE public.message_batches 
SET processing_started_at = NULL, processing_by = NULL 
WHERE id = 'a06c2f16-4d05-4665-9525-9d422aafe27b';