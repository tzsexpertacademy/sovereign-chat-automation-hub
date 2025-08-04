-- Atualizar mensagens existentes com client_id baseado na instância
UPDATE public.whatsapp_messages 
SET client_id = wi.client_id
FROM public.whatsapp_instances wi
WHERE whatsapp_messages.instance_id = wi.instance_id
AND whatsapp_messages.client_id IS NULL;