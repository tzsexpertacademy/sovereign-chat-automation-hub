-- Edge Function para processar regras de filas automáticas
-- Melhorar performance das consultas de tickets

-- Adicionar índices para otimizar consultas de tickets por fila
CREATE INDEX IF NOT EXISTS idx_conversation_tickets_queue_status 
ON conversation_tickets(assigned_queue_id, status) 
WHERE assigned_queue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_tickets_queue_activity 
ON conversation_tickets(assigned_queue_id, last_activity_at) 
WHERE assigned_queue_id IS NOT NULL;

-- Índice para otimizar consultas de métricas por data
CREATE INDEX IF NOT EXISTS idx_queue_metrics_queue_date 
ON queue_metrics(queue_id, date);

-- Função para calcular automaticamente tempo de espera
CREATE OR REPLACE FUNCTION calculate_waiting_time_minutes(created_at TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER / 60;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View otimizada para dados do Kanban
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

-- Função para atualizar métricas em tempo real
CREATE OR REPLACE FUNCTION update_queue_metrics_realtime()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar contadores básicos quando ticket muda de status ou fila
  IF TG_OP = 'UPDATE' THEN
    -- Se mudou de fila, atualizar ambas
    IF OLD.assigned_queue_id IS DISTINCT FROM NEW.assigned_queue_id THEN
      -- Registrar evento de transferência
      INSERT INTO ticket_events (ticket_id, event_type, description, metadata)
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
$$ LANGUAGE plpgsql;

-- Trigger para atualização automática de métricas
DROP TRIGGER IF EXISTS trigger_update_queue_metrics ON conversation_tickets;
CREATE TRIGGER trigger_update_queue_metrics
  AFTER INSERT OR UPDATE OR DELETE ON conversation_tickets
  FOR EACH ROW EXECUTE FUNCTION update_queue_metrics_realtime();

-- Função RPC para buscar estatísticas de fila em tempo real
CREATE OR REPLACE FUNCTION get_queue_realtime_stats(client_uuid UUID)
RETURNS TABLE(
  queue_id UUID,
  queue_name TEXT,
  active_tickets BIGINT,
  pending_tickets BIGINT,
  avg_waiting_time NUMERIC,
  oldest_ticket_minutes INTEGER,
  workload_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id as queue_id,
    q.name as queue_name,
    COUNT(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 END) as active_tickets,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tickets,
    AVG(calculate_waiting_time_minutes(t.created_at))::NUMERIC as avg_waiting_time,
    MAX(calculate_waiting_time_minutes(t.created_at))::INTEGER as oldest_ticket_minutes,
    LEAST(100, (COUNT(CASE WHEN t.status IN ('open', 'pending', 'in_progress') THEN 1 END) * 100 / NULLIF(q.max_concurrent_tickets, 0)))::INTEGER as workload_score
  FROM queues q
  LEFT JOIN conversation_tickets t ON q.id = t.assigned_queue_id 
    AND t.status IN ('open', 'pending', 'in_progress')
  WHERE q.client_id = client_uuid AND q.is_active = true
  GROUP BY q.id, q.name, q.max_concurrent_tickets
  ORDER BY q.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;