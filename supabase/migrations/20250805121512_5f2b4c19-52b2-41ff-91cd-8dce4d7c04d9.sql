-- Corrigir problemas de segurança identificados pelo linter

-- 1. Corrigir função calculate_waiting_time_minutes - adicionar search_path
CREATE OR REPLACE FUNCTION calculate_waiting_time_minutes(created_at TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER 
LANGUAGE plpgsql 
IMMUTABLE
SET search_path TO ''
AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER / 60;
END;
$$;

-- 2. Corrigir função update_queue_metrics_realtime - adicionar search_path e security definer
CREATE OR REPLACE FUNCTION update_queue_metrics_realtime()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Atualizar contadores básicos quando ticket muda de status ou fila
  IF TG_OP = 'UPDATE' THEN
    -- Se mudou de fila, atualizar ambas
    IF OLD.assigned_queue_id IS DISTINCT FROM NEW.assigned_queue_id THEN
      -- Registrar evento de transferência
      INSERT INTO public.ticket_events (ticket_id, event_type, description, metadata)
      VALUES (
        NEW.id,
        'queue_transfer',
        'Ticket transferido automaticamente',
        jsonb_build_object(
          'from_queue_id', OLD.assigned_queue_id,
          'to_queue_id', NEW.assigned_queue_id,
          'transfer_time', NOW()
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Corrigir função get_queue_realtime_stats - adicionar search_path
CREATE OR REPLACE FUNCTION get_queue_realtime_stats(client_uuid UUID)
RETURNS TABLE(
  queue_id UUID,
  queue_name TEXT,
  active_tickets BIGINT,
  pending_tickets BIGINT,
  avg_waiting_time NUMERIC,
  oldest_ticket_minutes INTEGER,
  workload_score INTEGER
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id as queue_id,
    q.name as queue_name,
    COUNT(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 END) as active_tickets,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tickets,
    AVG(public.calculate_waiting_time_minutes(t.created_at))::NUMERIC as avg_waiting_time,
    MAX(public.calculate_waiting_time_minutes(t.created_at))::INTEGER as oldest_ticket_minutes,
    LEAST(100, (COUNT(CASE WHEN t.status IN ('open', 'pending', 'in_progress') THEN 1 END) * 100 / NULLIF(q.max_concurrent_tickets, 0)))::INTEGER as workload_score
  FROM public.queues q
  LEFT JOIN public.conversation_tickets t ON q.id = t.assigned_queue_id 
    AND t.status IN ('open', 'pending', 'in_progress')
  WHERE q.client_id = client_uuid AND q.is_active = true
  GROUP BY q.id, q.name, q.max_concurrent_tickets
  ORDER BY q.name;
END;
$$;