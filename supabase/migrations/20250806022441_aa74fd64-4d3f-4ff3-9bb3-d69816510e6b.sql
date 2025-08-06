-- 🧹 LIMPEZA DE MENSAGENS DUPLICADAS (versão simples)
-- Remove duplicatas mantendo apenas a primeira ocorrência de cada message_id

WITH duplicates AS (
  SELECT 
    id,
    message_id,
    ROW_NUMBER() OVER (
      PARTITION BY message_id 
      ORDER BY created_at ASC
    ) as row_num
  FROM public.ticket_messages
  WHERE message_id IS NOT NULL
)
DELETE FROM public.ticket_messages 
WHERE id IN (
  SELECT id 
  FROM duplicates 
  WHERE row_num > 1
);

-- Adicionar índice único simples (sem CONCURRENTLY)
DROP INDEX IF EXISTS idx_ticket_messages_unique_message_id;
CREATE UNIQUE INDEX idx_ticket_messages_unique_message_id 
ON public.ticket_messages (message_id) 
WHERE message_id IS NOT NULL;