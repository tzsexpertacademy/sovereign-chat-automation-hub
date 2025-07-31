-- Adicionar coluna media_mime_type na tabela ticket_messages se não existir
ALTER TABLE public.ticket_messages 
ADD COLUMN IF NOT EXISTS media_mime_type text;

-- Criar índice para melhor performance nas consultas de mídia
CREATE INDEX IF NOT EXISTS idx_ticket_messages_media_type 
ON public.ticket_messages(message_type) 
WHERE message_type != 'text';

-- Criar índice para message_id para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_messages_message_id_unique 
ON public.ticket_messages(message_id);