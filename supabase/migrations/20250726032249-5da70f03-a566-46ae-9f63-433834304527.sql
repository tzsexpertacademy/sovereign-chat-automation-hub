-- Adicionar campos de metadados de criptografia à tabela whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS media_key TEXT,
ADD COLUMN IF NOT EXISTS file_enc_sha256 TEXT,
ADD COLUMN IF NOT EXISTS file_sha256 TEXT,
ADD COLUMN IF NOT EXISTS direct_path TEXT;

-- Criar tabela para cache de áudios descriptografados
CREATE TABLE IF NOT EXISTS public.decrypted_audio_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  decrypted_data TEXT NOT NULL,
  audio_format TEXT DEFAULT 'ogg',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '7 days')
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_decrypted_audio_cache_message_id 
ON public.decrypted_audio_cache (message_id);

CREATE INDEX IF NOT EXISTS idx_decrypted_audio_cache_expires_at 
ON public.decrypted_audio_cache (expires_at);

-- Criar função para limpeza automática de cache expirado
CREATE OR REPLACE FUNCTION public.cleanup_expired_decrypted_audio()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM public.decrypted_audio_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$function$;

-- Comentários para documentação
COMMENT ON TABLE public.decrypted_audio_cache IS 'Cache de áudios descriptografados do WhatsApp';
COMMENT ON COLUMN public.whatsapp_messages.media_key IS 'Chave de descriptografia de mídia do WhatsApp';
COMMENT ON COLUMN public.whatsapp_messages.file_enc_sha256 IS 'Hash SHA256 do arquivo criptografado';
COMMENT ON COLUMN public.whatsapp_messages.file_sha256 IS 'Hash SHA256 do arquivo original';
COMMENT ON COLUMN public.whatsapp_messages.direct_path IS 'Caminho direto da mídia no servidor WhatsApp';