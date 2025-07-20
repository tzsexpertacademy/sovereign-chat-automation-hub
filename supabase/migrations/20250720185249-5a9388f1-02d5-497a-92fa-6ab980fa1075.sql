
-- Criar tabela para planos de assinatura
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  max_instances INTEGER NOT NULL DEFAULT 1,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas as operações (acesso administrativo)
CREATE POLICY "Allow all operations on subscription_plans" 
  ON public.subscription_plans 
  FOR ALL 
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir planos iniciais
INSERT INTO public.subscription_plans (name, slug, description, max_instances, price_monthly, price_yearly, features, display_order, color) VALUES
('Básico', 'basic', 'Plano ideal para pequenos negócios que estão começando', 1, 29.90, 299.00, '["1 Instância WhatsApp", "Suporte básico", "Dashboard básico", "Relatórios simples"]', 1, '#10B981'),
('Padrão', 'standard', 'Plano perfeito para empresas em crescimento', 3, 69.90, 699.00, '["3 Instâncias WhatsApp", "Suporte prioritário", "Analytics avançado", "Automações básicas", "Integrações"]', 2, '#3B82F6'),
('Premium', 'premium', 'Solução completa para empresas estabelecidas', 10, 149.90, 1499.00, '["10 Instâncias WhatsApp", "Suporte 24/7", "API completa", "Automações avançadas", "Relatórios customizados", "Webhooks"]', 3, '#8B5CF6'),
('Enterprise', 'enterprise', 'Solução enterprise com recursos ilimitados', 50, 399.90, 3999.00, '["50 Instâncias WhatsApp", "Suporte dedicado", "White-label", "Customizações", "SLA garantido", "Prioridade máxima"]', 4, '#F59E0B');

-- Atualizar função para calcular max_instances baseado na nova tabela
CREATE OR REPLACE FUNCTION public.get_max_instances_for_plan(plan_slug text)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT max_instances FROM public.subscription_plans WHERE slug = plan_slug AND is_active = true),
    1
  );
$$;

-- Atualizar trigger para usar a nova função
CREATE OR REPLACE FUNCTION public.update_max_instances_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.max_instances = public.get_max_instances_for_plan(NEW.plan::text);
  RETURN NEW;
END;
$$;
