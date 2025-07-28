-- Criar tabela para contexto conversacional persistente
CREATE TABLE IF NOT EXISTS public.conversation_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  chat_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  conversation_summary TEXT,
  key_information JSONB DEFAULT '{}'::JSONB,
  last_topics JSONB DEFAULT '[]'::JSONB,
  personality_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, chat_id, instance_id)
);

-- Habilitar RLS
ALTER TABLE public.conversation_context ENABLE ROW LEVEL SECURITY;

-- Política de acesso para clientes
CREATE POLICY "Clients can manage their own conversation context"
ON public.conversation_context
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_conversation_context_updated_at
  BEFORE UPDATE ON public.conversation_context
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversation_context_client_chat 
  ON public.conversation_context(client_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_conversation_context_updated_at 
  ON public.conversation_context(updated_at DESC);