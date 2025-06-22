
-- Limpar todos os tickets e mensagens atuais para fazer uma nova importação
DELETE FROM public.ticket_messages;
DELETE FROM public.ticket_events;
DELETE FROM public.conversation_tickets;
DELETE FROM public.customers WHERE client_id = '35f36a03-39b2-412c-bba6-01fdd45c2dd3';

-- Resetar sequências se necessário
-- Este comando vai limpar todos os dados de tickets e permitir uma nova importação limpa
