-- Corrigir problemas de segurança: Habilitar RLS em todas as tabelas

-- Habilitar RLS nas tabelas que estão faltando
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para as tabelas do sistema de agendamento
CREATE POLICY "Clients can manage their own appointments" ON public.appointments
  FOR ALL USING (true);

CREATE POLICY "Clients can manage their own booking settings" ON public.booking_settings
  FOR ALL USING (true);

CREATE POLICY "Clients can manage their own professionals" ON public.professionals
  FOR ALL USING (true);

CREATE POLICY "Clients can manage their own professional schedules" ON public.professional_schedules
  FOR ALL USING (true);

CREATE POLICY "Clients can manage their own professional services" ON public.professional_services
  FOR ALL USING (true);

CREATE POLICY "Clients can manage their own services" ON public.services
  FOR ALL USING (true);

CREATE POLICY "Clients can manage their own schedule blocks" ON public.schedule_blocks
  FOR ALL USING (true);

-- Corrigir search_path nas funções existentes
CREATE OR REPLACE FUNCTION public.cleanup_expired_qr_codes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  cleanup_count INTEGER;
BEGIN
  UPDATE public.whatsapp_instances 
  SET 
    qr_code = NULL,
    has_qr_code = false,
    qr_expires_at = NULL,
    status = CASE 
      WHEN status = 'qr_ready' THEN 'disconnected'
      ELSE status
    END,
    updated_at = now()
  WHERE qr_expires_at IS NOT NULL 
    AND qr_expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_max_instances_for_plan(plan_slug text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT max_instances FROM public.subscription_plans WHERE slug = plan_slug AND is_active = true),
    1
  );
$function$;

CREATE OR REPLACE FUNCTION public.sync_business_instances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Atualizar referência nas instâncias quando business é atualizado
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.whatsapp_instances 
    SET business_business_id = NEW.business_id,
        updated_at = now()
    WHERE codechat_business_id = NEW.id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_client_instances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Atualizar contagem de instâncias do cliente
  UPDATE public.clients 
  SET current_instances = (
    SELECT COUNT(*) 
    FROM public.whatsapp_instances 
    WHERE client_id = COALESCE(NEW.client_id, OLD.client_id)
  )
  WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  
  -- Se é uma inserção e é a primeira instância do cliente, definir como instance_id principal
  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients 
    SET instance_id = NEW.instance_id,
        instance_status = NEW.status
    WHERE id = NEW.client_id 
    AND (instance_id IS NULL OR instance_id = '');
  END IF;
  
  -- Se é uma atualização de status, sincronizar com cliente
  IF TG_OP = 'UPDATE' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients 
    SET instance_status = NEW.status,
        last_activity = NEW.updated_at
    WHERE id = NEW.client_id 
    AND instance_id = NEW.instance_id;
  END IF;
  
  -- Se é uma remoção, limpar referência do cliente se necessário
  IF TG_OP = 'DELETE' AND OLD.client_id IS NOT NULL THEN
    UPDATE public.clients 
    SET instance_id = NULL,
        instance_status = 'disconnected'
    WHERE id = OLD.client_id 
    AND instance_id = OLD.instance_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_max_instances_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  NEW.max_instances = public.get_max_instances_for_plan(NEW.plan::text);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_max_instances_for_plan(plan_name plan_type)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT CASE 
    WHEN plan_name = 'basic' THEN 1
    WHEN plan_name = 'standard' THEN 3
    WHEN plan_name = 'premium' THEN 10
    WHEN plan_name = 'enterprise' THEN 50
    ELSE 1
  END;
$function$;

CREATE OR REPLACE FUNCTION public.update_current_instances_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clients 
    SET current_instances = (
      SELECT COUNT(*) 
      FROM public.whatsapp_instances 
      WHERE client_id = NEW.client_id
    )
    WHERE id = NEW.client_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clients 
    SET current_instances = (
      SELECT COUNT(*) 
      FROM public.whatsapp_instances 
      WHERE client_id = OLD.client_id
    )
    WHERE id = OLD.client_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_conversation_ticket(p_client_id uuid, p_chat_id text, p_instance_id text, p_customer_name text, p_customer_phone text, p_last_message text, p_last_message_at timestamp with time zone)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_customer_id UUID;
  v_ticket_id UUID;
  v_title TEXT;
BEGIN
  -- Encontrar ou criar cliente
  SELECT id INTO v_customer_id 
  FROM public.customers 
  WHERE client_id = p_client_id AND phone = p_customer_phone;
  
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (client_id, name, phone, whatsapp_chat_id)
    VALUES (p_client_id, p_customer_name, p_customer_phone, p_chat_id)
    RETURNING id INTO v_customer_id;
  END IF;
  
  -- Criar título do ticket
  v_title := 'Conversa com ' || p_customer_name;
  
  -- Inserir ou atualizar ticket
  INSERT INTO public.conversation_tickets (
    client_id, customer_id, chat_id, instance_id, title, 
    last_message_preview, last_message_at
  )
  VALUES (
    p_client_id, v_customer_id, p_chat_id, p_instance_id, v_title,
    p_last_message, p_last_message_at
  )
  ON CONFLICT (client_id, chat_id, instance_id) 
  DO UPDATE SET 
    last_message_preview = EXCLUDED.last_message_preview,
    last_message_at = EXCLUDED.last_message_at,
    updated_at = now()
  RETURNING id INTO v_ticket_id;
  
  RETURN v_ticket_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_queue_metrics()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_queue(
  p_client_id UUID,
  p_instance_id TEXT,
  p_message_content TEXT DEFAULT ''
) 
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
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
$$;