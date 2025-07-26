-- Adicionar colunas faltantes na tabela whatsapp_messages para compatibilidade com webhook YUMER
ALTER TABLE public.whatsapp_messages 
ADD COLUMN contact_name text,
ADD COLUMN phone_number text,
ADD COLUMN media_url text,
ADD COLUMN media_duration integer,
ADD COLUMN media_mime_type text,
ADD COLUMN raw_data jsonb,
ADD COLUMN processed_at timestamp with time zone,
ADD COLUMN source text DEFAULT 'yumer';