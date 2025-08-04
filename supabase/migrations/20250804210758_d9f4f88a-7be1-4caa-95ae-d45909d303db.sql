-- Adicionar coluna client_id à tabela whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id);