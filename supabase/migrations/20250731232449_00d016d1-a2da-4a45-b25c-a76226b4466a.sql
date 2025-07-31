-- Limpar duplicatas na tabela ticket_messages mantendo apenas a primeira ocorrência
DELETE FROM public.ticket_messages 
WHERE id NOT IN (
  SELECT DISTINCT ON (message_id) id
  FROM public.ticket_messages 
  ORDER BY message_id, created_at ASC
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