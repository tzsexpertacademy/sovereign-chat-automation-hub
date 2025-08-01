-- Adicionar campo direct_path na tabela ticket_messages
ALTER TABLE public.ticket_messages 
ADD COLUMN direct_path text;