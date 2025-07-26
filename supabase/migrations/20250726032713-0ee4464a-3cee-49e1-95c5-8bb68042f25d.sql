-- Adicionar colunas para metadados de criptografia do WhatsApp na tabela whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS media_key TEXT,
ADD COLUMN IF NOT EXISTS file_enc_sha256 TEXT,
ADD COLUMN IF NOT EXISTS file_sha256 TEXT,
ADD COLUMN IF NOT EXISTS direct_path TEXT;