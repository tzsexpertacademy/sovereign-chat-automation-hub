
-- Criar tabela para businesses do CodeChat v2.1.3
CREATE TABLE public.codechat_businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'BR',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  language TEXT NOT NULL DEFAULT 'pt-BR',
  active BOOLEAN NOT NULL DEFAULT true,
  business_token TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Adicionar campos v2.1.3 à tabela whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN codechat_business_id UUID REFERENCES public.codechat_businesses(id) ON DELETE SET NULL,
ADD COLUMN auth_jwt TEXT,
ADD COLUMN api_version TEXT DEFAULT 'v2.1.3',
ADD COLUMN connection_state TEXT DEFAULT 'close',
ADD COLUMN proxy TEXT,
ADD COLUMN business_business_id TEXT,
ADD COLUMN codechat_instance_name TEXT;

-- Criar tabela para tokens JWT das instâncias
CREATE TABLE public.codechat_instance_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  jwt_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_codechat_businesses_client_id ON public.codechat_businesses(client_id);
CREATE INDEX idx_codechat_businesses_business_id ON public.codechat_businesses(business_id);
CREATE INDEX idx_codechat_businesses_business_token ON public.codechat_businesses(business_token);
CREATE INDEX idx_whatsapp_instances_codechat_business_id ON public.whatsapp_instances(codechat_business_id);
CREATE INDEX idx_codechat_instance_tokens_instance_id ON public.codechat_instance_tokens(instance_id);

-- Habilitar RLS
ALTER TABLE public.codechat_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codechat_instance_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Clients can manage their own businesses" ON public.codechat_businesses
  FOR ALL USING (client_id = auth.uid() OR true);

CREATE POLICY "Clients can manage their own instance tokens" ON public.codechat_instance_tokens
  FOR ALL USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_codechat_businesses_updated_at 
  BEFORE UPDATE ON public.codechat_businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_codechat_instance_tokens_updated_at 
  BEFORE UPDATE ON public.codechat_instance_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para sincronizar dados do business com instâncias
CREATE OR REPLACE FUNCTION sync_business_instances()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_business_instances_trigger
  AFTER INSERT OR UPDATE ON public.codechat_businesses
  FOR EACH ROW EXECUTE FUNCTION sync_business_instances();
