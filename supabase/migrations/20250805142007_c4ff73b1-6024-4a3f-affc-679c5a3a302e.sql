-- TESTE 1: Forçar reabertura do ticket para testar listeners realtime
UPDATE public.conversation_tickets 
SET 
  status = 'open',
  closed_at = NULL,
  updated_at = now()
WHERE id = 'ff487be2-f85d-42e9-afed-4e18ee11a3b8';