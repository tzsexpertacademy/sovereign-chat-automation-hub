-- Adicionar colunas base64 para todos os tipos de mídia na tabela ticket_messages
ALTER TABLE public.ticket_messages 
ADD COLUMN IF NOT EXISTS image_base64 text,
ADD COLUMN IF NOT EXISTS video_base64 text, 
ADD COLUMN IF NOT EXISTS document_base64 text;