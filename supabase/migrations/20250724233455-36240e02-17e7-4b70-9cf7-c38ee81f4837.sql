-- Fase 2: Expansão das tabelas para CRM Orquestrado

-- Expandir tabela queues com configurações avançadas
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS auto_assignment BOOLEAN DEFAULT true;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS handoff_triggers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{"enabled": false, "timezone": "America/Sao_Paulo", "schedule": {}}'::jsonb;
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS max_concurrent_tickets INTEGER DEFAULT 10;

-- Expandir tabela conversation_tickets com campos de orquestração
ALTER TABLE public.conversation_tickets ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 1;
ALTER TABLE public.conversation_tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.conversation_tickets ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.conversation_tickets ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.conversation_tickets ADD COLUMN IF NOT EXISTS queue_assignment_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.conversation_tickets ADD COLUMN IF NOT EXISTS ai_processing_attempts INTEGER DEFAULT 0;
ALTER TABLE public.conversation_tickets ADD COLUMN IF NOT EXISTS human_takeover_reason TEXT;

-- Criar tabela para campanhas automatizadas
CREATE TABLE IF NOT EXISTS public.automated_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  queue_id UUID REFERENCES public.queues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_conditions JSONB DEFAULT '[]'::jsonb,
  message_template TEXT NOT NULL,
  schedule_config JSONB DEFAULT '{}'::jsonb,
  target_filters JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  send_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela para histórico de transferências entre filas
CREATE TABLE IF NOT EXISTS public.queue_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.conversation_tickets(id) ON DELETE CASCADE,
  from_queue_id UUID REFERENCES public.queues(id),
  to_queue_id UUID REFERENCES public.queues(id),
  transfer_reason TEXT NOT NULL,
  transfer_type TEXT DEFAULT 'manual', -- manual, automatic, escalation
  initiated_by TEXT, -- user_id, assistant_id, or 'system'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela para métricas de performance das filas
CREATE TABLE IF NOT EXISTS public.queue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tickets_received INTEGER DEFAULT 0,
  tickets_resolved INTEGER DEFAULT 0,
  avg_response_time_minutes NUMERIC DEFAULT 0,
  avg_resolution_time_minutes NUMERIC DEFAULT 0,
  ai_success_rate NUMERIC DEFAULT 0,
  human_handoff_rate NUMERIC DEFAULT 0,
  customer_satisfaction_avg NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(queue_id, date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversation_tickets_queue_assignment ON public.conversation_tickets(assigned_queue_id, status);
CREATE INDEX IF NOT EXISTS idx_conversation_tickets_last_activity ON public.conversation_tickets(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_queue_transfers_ticket ON public.queue_transfers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_automated_campaigns_client ON public.automated_campaigns(client_id, is_active);
CREATE INDEX IF NOT EXISTS idx_queue_metrics_date ON public.queue_metrics(queue_id, date);

-- Função para atualizar métricas automaticamente
CREATE OR REPLACE FUNCTION public.update_queue_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar métricas quando ticket é resolvido ou fechado
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status IN ('resolved', 'closed')) THEN
    INSERT INTO public.queue_metrics (queue_id, date, tickets_resolved)
    VALUES (NEW.assigned_queue_id, CURRENT_DATE, 1)
    ON CONFLICT (queue_id, date)
    DO UPDATE SET 
      tickets_resolved = queue_metrics.tickets_resolved + 1,
      avg_resolution_time_minutes = CASE 
        WHEN NEW.created_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 60
        ELSE queue_metrics.avg_resolution_time_minutes
      END;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para métricas automáticas
DROP TRIGGER IF EXISTS update_queue_metrics_trigger ON public.conversation_tickets;
CREATE TRIGGER update_queue_metrics_trigger
  AFTER UPDATE ON public.conversation_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_queue_metrics();

-- Função para auto-atribuição de fila baseada em regras
CREATE OR REPLACE FUNCTION public.auto_assign_queue(
  p_client_id UUID,
  p_instance_id TEXT,
  p_message_content TEXT DEFAULT ''
) RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
  v_connection_count INTEGER;
BEGIN
  -- Buscar fila ativa conectada à instância com menor carga
  SELECT q.id INTO v_queue_id
  FROM public.queues q
  JOIN public.instance_queue_connections iqc ON q.id = iqc.queue_id
  JOIN public.whatsapp_instances wi ON iqc.instance_id = wi.id
  WHERE q.client_id = p_client_id
    AND q.is_active = true
    AND iqc.is_active = true
    AND wi.instance_id = p_instance_id
    AND q.auto_assignment = true
  ORDER BY (
    SELECT COUNT(*) 
    FROM public.conversation_tickets ct 
    WHERE ct.assigned_queue_id = q.id 
    AND ct.status IN ('open', 'pending')
  ) ASC
  LIMIT 1;
  
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- RLS para novas tabelas
ALTER TABLE public.automated_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Clients can manage their own campaigns" ON public.automated_campaigns
  FOR ALL USING (true);

CREATE POLICY "Clients can view their own queue transfers" ON public.queue_transfers
  FOR ALL USING (true);

CREATE POLICY "Clients can view their own queue metrics" ON public.queue_metrics
  FOR ALL USING (true);