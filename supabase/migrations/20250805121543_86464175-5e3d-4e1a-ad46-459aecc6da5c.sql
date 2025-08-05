-- Corrigir view security definer removendo SECURITY DEFINER
-- Recriar a view sem SECURITY DEFINER

DROP VIEW IF EXISTS queue_kanban_tickets;

-- Recriar view sem SECURITY DEFINER (views devem usar permissões do usuário atual)
CREATE OR REPLACE VIEW queue_kanban_tickets AS
SELECT 
  t.id,
  t.title,
  t.status,
  t.priority,
  t.created_at,
  t.last_activity_at,
  t.chat_id,
  t.instance_id,
  t.assigned_queue_id,
  c.name as customer_name,
  c.phone as customer_phone,
  calculate_waiting_time_minutes(t.created_at) as waiting_time_minutes,
  q.name as queue_name
FROM conversation_tickets t
LEFT JOIN customers c ON t.customer_id = c.id
LEFT JOIN queues q ON t.assigned_queue_id = q.id
WHERE t.status IN ('open', 'pending', 'in_progress')
  AND t.assigned_queue_id IS NOT NULL;