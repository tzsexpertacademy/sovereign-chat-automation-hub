-- Adicionar coluna auth_token para armazenar Bearer token de cada instância
ALTER TABLE public.whatsapp_instances 
ADD COLUMN auth_token TEXT;