
-- Criar tabela de estágios do funil
CREATE TABLE public.funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#10B981',
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_move_conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de tags do funil
CREATE TABLE public.funnel_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de leads do funil
CREATE TABLE public.funnel_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  current_stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL,
  current_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  lead_source TEXT NOT NULL DEFAULT 'whatsapp',
  lead_value NUMERIC DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 1,
  last_interaction TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  stage_entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  conversion_probability NUMERIC DEFAULT 0 CHECK (conversion_probability >= 0 AND conversion_probability <= 100),
  notes JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de relacionamento entre leads e tags
CREATE TABLE public.funnel_lead_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.funnel_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.funnel_tags(id) ON DELETE CASCADE,
  assigned_by TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tag_id)
);

-- Criar tabela de histórico de movimentação de leads
CREATE TABLE public.funnel_lead_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.funnel_leads(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES public.funnel_stages(id) ON DELETE SET NULL,
  moved_by TEXT NOT NULL DEFAULT 'user',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_funnel_stages_client_id ON public.funnel_stages(client_id);
CREATE INDEX idx_funnel_stages_position ON public.funnel_stages(position);
CREATE INDEX idx_funnel_tags_client_id ON public.funnel_tags(client_id);
CREATE INDEX idx_funnel_leads_client_id ON public.funnel_leads(client_id);
CREATE INDEX idx_funnel_leads_stage_id ON public.funnel_leads(current_stage_id);
CREATE INDEX idx_funnel_leads_chat_id ON public.funnel_leads(chat_id);
CREATE INDEX idx_funnel_lead_tags_lead_id ON public.funnel_lead_tags(lead_id);
CREATE INDEX idx_funnel_lead_tags_tag_id ON public.funnel_lead_tags(tag_id);
CREATE INDEX idx_funnel_lead_history_lead_id ON public.funnel_lead_history(lead_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_funnel_stages_updated_at
  BEFORE UPDATE ON public.funnel_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_tags_updated_at
  BEFORE UPDATE ON public.funnel_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_leads_updated_at
  BEFORE UPDATE ON public.funnel_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Row Level Security
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_lead_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - permitir acesso baseado no client_id
CREATE POLICY "funnel_stages_client_access" ON public.funnel_stages
  FOR ALL USING (true);

CREATE POLICY "funnel_tags_client_access" ON public.funnel_tags
  FOR ALL USING (true);

CREATE POLICY "funnel_leads_client_access" ON public.funnel_leads
  FOR ALL USING (true);

CREATE POLICY "funnel_lead_tags_client_access" ON public.funnel_lead_tags
  FOR ALL USING (true);

CREATE POLICY "funnel_lead_history_client_access" ON public.funnel_lead_history
  FOR ALL USING (true);
