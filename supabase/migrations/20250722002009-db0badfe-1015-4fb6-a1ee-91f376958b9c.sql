
-- Habilitar realtime para a tabela ticket_messages
-- Configurar REPLICA IDENTITY FULL para capturar dados completos durante updates
ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime do Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
