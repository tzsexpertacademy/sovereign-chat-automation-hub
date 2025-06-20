
-- Tabela para configurações de API dos clientes
CREATE TABLE public.client_ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  openai_api_key TEXT NOT NULL,
  default_model TEXT DEFAULT 'gpt-4o-mini' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(client_id)
);

-- Tabela para assistentes
CREATE TABLE public.assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o-mini' NOT NULL,
  triggers JSONB DEFAULT '[]'::jsonb, -- Array de gatilhos para transferência de fila
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela para filas
CREATE TABLE public.queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  assistant_id UUID REFERENCES public.assistants(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela para conectar instâncias WhatsApp às filas
CREATE TABLE public.instance_queue_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE NOT NULL,
  queue_id UUID REFERENCES public.queues(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(instance_id, queue_id)
);

-- Tabela para rastrear conversas ativas e suas filas atuais
CREATE TABLE public.conversation_queue_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE NOT NULL,
  current_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
  conversation_context JSONB DEFAULT '{}'::jsonb,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(chat_id, instance_id)
);

-- Índices para performance
CREATE INDEX idx_assistants_client_id ON public.assistants(client_id);
CREATE INDEX idx_queues_client_id ON public.queues(client_id);
CREATE INDEX idx_queues_assistant_id ON public.queues(assistant_id);
CREATE INDEX idx_conversation_states_chat_instance ON public.conversation_queue_states(chat_id, instance_id);
CREATE INDEX idx_conversation_states_queue ON public.conversation_queue_states(current_queue_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_ai_configs_updated_at BEFORE UPDATE ON public.client_ai_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assistants_updated_at BEFORE UPDATE ON public.assistants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversation_queue_states_updated_at BEFORE UPDATE ON public.conversation_queue_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE public.client_ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_queue_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_queue_states ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (ajustar conforme necessário quando implementar autenticação)
CREATE POLICY "Users can manage their own AI configs" ON public.client_ai_configs FOR ALL USING (true);
CREATE POLICY "Users can manage their own assistants" ON public.assistants FOR ALL USING (true);
CREATE POLICY "Users can manage their own queues" ON public.queues FOR ALL USING (true);
CREATE POLICY "Users can manage their own connections" ON public.instance_queue_connections FOR ALL USING (true);
CREATE POLICY "Users can manage their own conversation states" ON public.conversation_queue_states FOR ALL USING (true);
