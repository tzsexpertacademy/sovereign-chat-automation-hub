
-- Criar tabela para clientes
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  company TEXT,
  instance_id TEXT,
  instance_status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela para instâncias WhatsApp
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'disconnected',
  phone_number TEXT,
  qr_code TEXT,
  has_qr_code BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para conversas
CREATE TABLE public.whatsapp_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  name TEXT,
  is_group BOOLEAN DEFAULT false,
  profile_pic_url TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, chat_id)
);

-- Criar tabela para mensagens
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  from_me BOOLEAN DEFAULT false,
  sender TEXT,
  body TEXT,
  message_type TEXT DEFAULT 'text',
  timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(instance_id, message_id)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para permitir acesso total (como é um sistema admin)
CREATE POLICY "Allow all operations on clients" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow all operations on whatsapp_instances" ON public.whatsapp_instances FOR ALL USING (true);
CREATE POLICY "Allow all operations on whatsapp_chats" ON public.whatsapp_chats FOR ALL USING (true);
CREATE POLICY "Allow all operations on whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (true);

-- Criar índices para melhor performance
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_clients_instance_id ON public.clients(instance_id);
CREATE INDEX idx_whatsapp_instances_client_id ON public.whatsapp_instances(client_id);
CREATE INDEX idx_whatsapp_instances_instance_id ON public.whatsapp_instances(instance_id);
CREATE INDEX idx_whatsapp_chats_instance_id ON public.whatsapp_chats(instance_id);
CREATE INDEX idx_whatsapp_messages_instance_id ON public.whatsapp_messages(instance_id);
CREATE INDEX idx_whatsapp_messages_chat_id ON public.whatsapp_messages(chat_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_chats_updated_at BEFORE UPDATE ON public.whatsapp_chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
