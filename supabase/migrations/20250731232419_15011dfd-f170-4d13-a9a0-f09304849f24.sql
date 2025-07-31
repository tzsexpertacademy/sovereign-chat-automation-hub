-- Limpar duplicatas na tabela ticket_messages mantendo apenas a mais recente
WITH duplicates AS (
  SELECT message_id, 
         MIN(id) as first_id,
         COUNT(*) as count
  FROM public.ticket_messages 
  GROUP BY message_id 
  HAVING COUNT(*) > 1
)
DELETE FROM public.ticket_messages 
WHERE id NOT IN (
  SELECT first_id FROM duplicates
) AND message_id IN (
  SELECT message_id FROM duplicates
);

-- Adicionar coluna media_mime_type se não existir
ALTER TABLE public.ticket_messages 
ADD COLUMN IF NOT EXISTS media_mime_type text;

-- Criar índice único para message_id para prevenir duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_messages_message_id_unique 
ON public.ticket_messages(message_id);

-- Criar índice para melhor performance nas consultas de mídia
CREATE INDEX IF NOT EXISTS idx_ticket_messages_media_type 
ON public.ticket_messages(message_type) 
WHERE message_type != 'text';