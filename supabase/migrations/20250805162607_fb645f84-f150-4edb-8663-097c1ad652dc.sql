-- CORREÇÃO DO BATCHING: Atualizar client_id nas mensagens sem client_id
-- Usar a relação instance_id -> client_id da tabela whatsapp_instances

UPDATE public.whatsapp_messages 
SET client_id = wi.client_id
FROM public.whatsapp_instances wi
WHERE whatsapp_messages.client_id IS NULL 
  AND wi.instance_id = whatsapp_messages.instance_id
  AND wi.client_id IS NOT NULL;

-- Log para confirmar quantas mensagens foram atualizadas
-- SELECT COUNT(*) FROM public.whatsapp_messages WHERE client_id IS NOT NULL;