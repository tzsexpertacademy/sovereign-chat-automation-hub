-- Adicionar colunas necessárias para webhook e importação
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS webhook_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_import_at timestamp with time zone DEFAULT NULL;