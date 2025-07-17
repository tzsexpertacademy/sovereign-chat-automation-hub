-- ========== CORREÇÃO DA ARQUITETURA DE DADOS ==========
-- Este migration corrige problemas fundamentais de sincronização entre tabelas

-- 1. Primeiro, vamos limpar dados inconsistentes
-- Remover instâncias órfãs (sem client_id válido)
DELETE FROM public.whatsapp_instances 
WHERE client_id IS NOT NULL 
AND client_id NOT IN (SELECT id FROM public.clients);

-- 2. Sincronizar clients.instance_id com whatsapp_instances
-- Limpar instance_id de clientes que não têm instâncias válidas
UPDATE public.clients 
SET instance_id = NULL, 
    instance_status = 'disconnected',
    current_instances = 0
WHERE instance_id IS NOT NULL 
AND instance_id NOT IN (SELECT instance_id FROM public.whatsapp_instances WHERE instance_id IS NOT NULL);

-- 3. Atualizar clients.current_instances baseado na contagem real
UPDATE public.clients 
SET current_instances = (
  SELECT COUNT(*) 
  FROM public.whatsapp_instances 
  WHERE client_id = clients.id
);

-- 4. Para clientes com apenas uma instância, sincronizar o instance_id
UPDATE public.clients 
SET instance_id = (
  SELECT instance_id 
  FROM public.whatsapp_instances 
  WHERE client_id = clients.id 
  ORDER BY created_at DESC 
  LIMIT 1
)
WHERE id IN (
  SELECT client_id 
  FROM public.whatsapp_instances 
  WHERE client_id IS NOT NULL 
  GROUP BY client_id 
  HAVING COUNT(*) = 1
);

-- 5. Criar função para manter sincronização automática
CREATE OR REPLACE FUNCTION public.sync_client_instances()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar contagem de instâncias do cliente
  UPDATE public.clients 
  SET current_instances = (
    SELECT COUNT(*) 
    FROM public.whatsapp_instances 
    WHERE client_id = COALESCE(NEW.client_id, OLD.client_id)
  )
  WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  
  -- Se é uma inserção e é a primeira instância do cliente, definir como instance_id principal
  IF TG_OP = 'INSERT' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients 
    SET instance_id = NEW.instance_id,
        instance_status = NEW.status
    WHERE id = NEW.client_id 
    AND (instance_id IS NULL OR instance_id = '');
  END IF;
  
  -- Se é uma atualização de status, sincronizar com cliente
  IF TG_OP = 'UPDATE' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients 
    SET instance_status = NEW.status,
        last_activity = NEW.updated_at
    WHERE id = NEW.client_id 
    AND instance_id = NEW.instance_id;
  END IF;
  
  -- Se é uma remoção, limpar referência do cliente se necessário
  IF TG_OP = 'DELETE' AND OLD.client_id IS NOT NULL THEN
    UPDATE public.clients 
    SET instance_id = NULL,
        instance_status = 'disconnected'
    WHERE id = OLD.client_id 
    AND instance_id = OLD.instance_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 6. Criar triggers para sincronização automática
DROP TRIGGER IF EXISTS sync_client_instances_trigger ON public.whatsapp_instances;

CREATE TRIGGER sync_client_instances_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_instances();

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_client_id ON public.whatsapp_instances(client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_id ON public.whatsapp_instances(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON public.whatsapp_instances(status);

-- 8. Cleanup de QR codes expirados (melhoria)
UPDATE public.whatsapp_instances 
SET qr_code = NULL,
    has_qr_code = false,
    qr_expires_at = NULL
WHERE qr_expires_at IS NOT NULL 
AND qr_expires_at < now();

-- Relatório final de sincronização
DO $$
DECLARE
    total_clients INTEGER;
    total_instances INTEGER;
    orphaned_instances INTEGER;
    clients_with_instances INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_clients FROM public.clients;
    SELECT COUNT(*) INTO total_instances FROM public.whatsapp_instances;
    SELECT COUNT(*) INTO orphaned_instances FROM public.whatsapp_instances WHERE client_id IS NULL;
    SELECT COUNT(*) INTO clients_with_instances FROM public.clients WHERE current_instances > 0;
    
    RAISE NOTICE '============ RELATÓRIO DE SINCRONIZAÇÃO ============';
    RAISE NOTICE 'Total de clientes: %', total_clients;
    RAISE NOTICE 'Total de instâncias: %', total_instances;
    RAISE NOTICE 'Instâncias órfãs: %', orphaned_instances;
    RAISE NOTICE 'Clientes com instâncias: %', clients_with_instances;
    RAISE NOTICE '================================================';
END $$;