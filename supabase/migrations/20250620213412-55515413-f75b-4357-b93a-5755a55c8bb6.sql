
-- Criar enum para tipos de planos
CREATE TYPE public.plan_type AS ENUM ('basic', 'standard', 'premium', 'enterprise');

-- Adicionar colunas de plano na tabela clients
ALTER TABLE public.clients 
ADD COLUMN plan public.plan_type DEFAULT 'basic',
ADD COLUMN max_instances INTEGER DEFAULT 1,
ADD COLUMN current_instances INTEGER DEFAULT 0;

-- Atualizar a tabela whatsapp_instances para melhor relacionamento
ALTER TABLE public.whatsapp_instances 
ADD CONSTRAINT unique_client_instance UNIQUE (client_id, instance_id);

-- Criar função para definir número máximo de instâncias baseado no plano
CREATE OR REPLACE FUNCTION public.get_max_instances_for_plan(plan_name public.plan_type)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN plan_name = 'basic' THEN 1
    WHEN plan_name = 'standard' THEN 3
    WHEN plan_name = 'premium' THEN 10
    WHEN plan_name = 'enterprise' THEN 50
    ELSE 1
  END;
$$;

-- Trigger para atualizar max_instances automaticamente quando o plano muda
CREATE OR REPLACE FUNCTION public.update_max_instances_on_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.max_instances = public.get_max_instances_for_plan(NEW.plan);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_max_instances
  BEFORE UPDATE OF plan ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_max_instances_on_plan_change();

-- Trigger para atualizar current_instances quando instâncias são criadas/removidas
CREATE OR REPLACE FUNCTION public.update_current_instances_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

CREATE TRIGGER trigger_update_current_instances
  AFTER INSERT OR DELETE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_current_instances_count();

-- Atualizar clientes existentes com valores padrão
UPDATE public.clients 
SET 
  max_instances = public.get_max_instances_for_plan(plan),
  current_instances = (
    SELECT COUNT(*) 
    FROM public.whatsapp_instances 
    WHERE client_id = clients.id
  );
