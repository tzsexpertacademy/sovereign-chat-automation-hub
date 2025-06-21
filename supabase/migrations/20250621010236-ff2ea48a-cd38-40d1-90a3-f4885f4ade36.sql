
-- Criar tabela para tickets de conversas
CREATE TABLE public.conversation_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  chat_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 1,
  assigned_queue_id UUID REFERENCES public.queues(id),
  assigned_assistant_id UUID REFERENCES public.assistants(id),
  last_message_preview TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  customer_satisfaction_score INTEGER,
  resolution_time_minutes INTEGER,
  tags JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  internal_notes JSONB DEFAULT '[]'::jsonb,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(client_id, chat_id, instance_id)
);

-- Criar tabela para mensagens do ticket
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.conversation_tickets(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  from_me BOOLEAN DEFAULT false,
  sender_name TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  is_internal_note BOOLEAN DEFAULT false,
  is_ai_response BOOLEAN DEFAULT false,
  ai_confidence_score NUMERIC(3,2),
  processing_status TEXT DEFAULT 'processed',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para eventos do ticket
CREATE TABLE public.ticket_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.conversation_tickets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_conversation_tickets_client_id ON public.conversation_tickets(client_id);
CREATE INDEX idx_conversation_tickets_customer_id ON public.conversation_tickets(customer_id);
CREATE INDEX idx_conversation_tickets_status ON public.conversation_tickets(status);
CREATE INDEX idx_conversation_tickets_last_message_at ON public.conversation_tickets(last_message_at DESC);
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_timestamp ON public.ticket_messages(timestamp DESC);
CREATE INDEX idx_ticket_events_ticket_id ON public.ticket_events(ticket_id);

-- Habilitar RLS
ALTER TABLE public.conversation_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow all operations on conversation_tickets" ON public.conversation_tickets FOR ALL USING (true);
CREATE POLICY "Allow all operations on ticket_messages" ON public.ticket_messages FOR ALL USING (true);
CREATE POLICY "Allow all operations on ticket_events" ON public.ticket_events FOR ALL USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_conversation_tickets_updated_at 
  BEFORE UPDATE ON public.conversation_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para criar ou atualizar ticket baseado na conversa
CREATE OR REPLACE FUNCTION public.upsert_conversation_ticket(
  p_client_id UUID,
  p_chat_id TEXT,
  p_instance_id TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_last_message TEXT,
  p_last_message_at TIMESTAMP WITH TIME ZONE
) RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql;
