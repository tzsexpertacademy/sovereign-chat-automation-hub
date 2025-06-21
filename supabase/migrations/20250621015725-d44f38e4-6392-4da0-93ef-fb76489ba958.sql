
-- Adicionar coluna custom_name na tabela whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN custom_name TEXT;

-- Criar índice para melhor performance
CREATE INDEX idx_whatsapp_instances_custom_name 
ON public.whatsapp_instances(custom_name);
