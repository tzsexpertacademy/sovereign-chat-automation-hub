-- Criar tabela de solicitações de personalização
CREATE TABLE public.personalization_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'funcionalidade',
  priority TEXT NOT NULL DEFAULT 'media',
  description TEXT NOT NULL,
  business_impact TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  budget_estimate TEXT,
  technical_requirements JSONB DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'aguardando_analise',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela de comentários das solicitações
CREATE TABLE public.personalization_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.personalization_requests(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('client', 'admin')),
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.personalization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalization_comments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para personalization_requests
CREATE POLICY "Clients can manage their own requests"
ON public.personalization_requests
FOR ALL
USING (true)
WITH CHECK (true);

-- Políticas RLS para personalization_comments  
CREATE POLICY "Users can manage their own comments"
ON public.personalization_comments
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_personalization_requests_updated_at
  BEFORE UPDATE ON public.personalization_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();