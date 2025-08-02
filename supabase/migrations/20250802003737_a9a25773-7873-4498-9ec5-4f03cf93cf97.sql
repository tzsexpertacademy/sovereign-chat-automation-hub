-- Corrigir tickets existentes sem assigned_assistant_id
-- Associar assistente baseado na fila atribuída

UPDATE public.conversation_tickets 
SET assigned_assistant_id = q.assistant_id,
    updated_at = now()
FROM public.queues q
WHERE conversation_tickets.assigned_queue_id = q.id
  AND conversation_tickets.assigned_assistant_id IS NULL
  AND q.assistant_id IS NOT NULL
  AND q.is_active = true;