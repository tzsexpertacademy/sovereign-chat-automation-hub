-- Adicionar coluna para armazenar o nome real da instância retornado pelo YUMER
ALTER TABLE public.whatsapp_instances 
ADD COLUMN yumer_instance_name TEXT;