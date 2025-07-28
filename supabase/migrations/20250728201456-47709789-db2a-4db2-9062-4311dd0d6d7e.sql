-- Criar tabela para gerenciar batches de mensagens
CREATE TABLE public.message_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id TEXT NOT NULL,
  client_id UUID NOT NULL,
  instance_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice único para evitar batches duplicados
CREATE UNIQUE INDEX idx_message_batches_chat_client ON public.message_batches(chat_id, client_id);

-- Criar índice para busca por last_updated
CREATE INDEX idx_message_batches_last_updated ON public.message_batches(last_updated);

-- Habilitar RLS
ALTER TABLE public.message_batches ENABLE ROW LEVEL SECURITY;

-- Política RLS - permitir acesso a todos os batches
CREATE POLICY "Allow all operations on message_batches" 
ON public.message_batches 
FOR ALL 
USING (true);