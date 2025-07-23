
-- PLANO DE MIGRAÇÃO COMPLETO PARA CODECHAT V2.2.1

-- 1. Remover tabelas obsoletas da v1 e duplicadas
DROP TABLE IF EXISTS public.codechat_businesses CASCADE;
DROP TABLE IF EXISTS public.codechat_instance_tokens CASCADE;

-- 2. Atualizar tabela whatsapp_instances para v2.2.1
-- Remover campos obsoletos/duplicados
ALTER TABLE public.whatsapp_instances 
DROP COLUMN IF EXISTS codechat_business_id,
DROP COLUMN IF EXISTS business_business_id,
DROP COLUMN IF EXISTS auth_token,
DROP COLUMN IF EXISTS auth_jwt,
DROP COLUMN IF EXISTS codechat_instance_name,
DROP COLUMN IF EXISTS yumer_instance_name,
DROP COLUMN IF EXISTS api_version,
DROP COLUMN IF EXISTS proxy,
DROP COLUMN IF EXISTS webhook_enabled,
DROP COLUMN IF EXISTS last_import_at;

-- Adicionar campos necessários para v2.2.1
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS server_url TEXT DEFAULT 'https://api.yumer.com.br',
ADD COLUMN IF NOT EXISTS api_key TEXT,
ADD COLUMN IF NOT EXISTS owner_jid TEXT,
ADD COLUMN IF NOT EXISTS profile_name TEXT,
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_events JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS integration_token TEXT,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Renomear campos para seguir padrão v2.2.1
ALTER TABLE public.whatsapp_instances 
RENAME COLUMN connection_state TO state;

-- Atualizar valores padrão
UPDATE public.whatsapp_instances 
SET 
  server_url = 'https://api.yumer.com.br',
  state = CASE 
    WHEN status = 'connected' THEN 'open'
    WHEN status = 'connecting' THEN 'connecting' 
    ELSE 'close'
  END,
  webhook_events = '["qrcode.updated", "connection.update", "messages.upsert", "messages.update", "chats.upsert", "contacts.upsert"]'::jsonb
WHERE server_url IS NULL;

-- 3. Criar índices otimizados para v2.2.1
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_state ON public.whatsapp_instances(state);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_owner_jid ON public.whatsapp_instances(owner_jid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_api_key ON public.whatsapp_instances(api_key);

-- 4. Atualizar tabela whatsapp_messages para v2.2.1
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF EXISTS key_remote_jid TEXT,
ADD COLUMN IF NOT EXISTS key_from_me BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS key_id TEXT,
ADD COLUMN IF NOT EXISTS push_name TEXT,
ADD COLUMN IF NOT EXISTS message_timestamp BIGINT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received';

-- Migrar dados existentes
UPDATE public.whatsapp_messages 
SET 
  key_remote_jid = chat_id,
  key_from_me = from_me,
  key_id = message_id,
  message_timestamp = EXTRACT(epoch FROM timestamp)::bigint
WHERE key_remote_jid IS NULL;

-- 5. Atualizar tabela whatsapp_chats para v2.2.1  
ALTER TABLE public.whatsapp_chats
ADD COLUMN IF NOT EXISTS remote_jid TEXT,
ADD COLUMN IF NOT EXISTS push_name TEXT,
ADD COLUMN IF NOT EXISTS is_wa_contact BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS verified_name TEXT;

-- Migrar dados
UPDATE public.whatsapp_chats 
SET remote_jid = chat_id
WHERE remote_jid IS NULL;

-- 6. Função para limpeza automática de QR codes expirados (mantém existente)
-- Já existe: cleanup_expired_qr_codes()

-- 7. Função para sincronização de instâncias v2.2.1
CREATE OR REPLACE FUNCTION public.sync_instance_v2()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar status do cliente baseado na instância
  IF TG_OP = 'UPDATE' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients 
    SET 
      instance_status = CASE 
        WHEN NEW.state = 'open' THEN 'connected'
        WHEN NEW.state = 'connecting' THEN 'connecting'
        ELSE 'disconnected'
      END,
      last_activity = NEW.updated_at
    WHERE id = NEW.client_id AND instance_id = NEW.instance_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para sincronização
DROP TRIGGER IF EXISTS trigger_sync_instance_v2 ON public.whatsapp_instances;
CREATE TRIGGER trigger_sync_instance_v2
  AFTER UPDATE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_instance_v2();

-- 8. Comentários para documentação
COMMENT ON COLUMN public.whatsapp_instances.server_url IS 'URL do servidor CodeChat v2.2.1';
COMMENT ON COLUMN public.whatsapp_instances.api_key IS 'API Key global para autenticação';
COMMENT ON COLUMN public.whatsapp_instances.state IS 'Estado da conexão: open, connecting, close';
COMMENT ON COLUMN public.whatsapp_instances.owner_jid IS 'JID do proprietário da instância';
COMMENT ON COLUMN public.whatsapp_instances.webhook_events IS 'Eventos do webhook habilitados';
COMMENT ON COLUMN public.whatsapp_instances.integration_token IS 'Token de integração para webhooks';
