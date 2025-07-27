-- Criar tabelas de cache para vídeos e documentos descriptografados
CREATE TABLE IF NOT EXISTS public.decrypted_video_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  decrypted_data TEXT NOT NULL,
  video_format TEXT NOT NULL DEFAULT 'mp4',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.decrypted_document_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  decrypted_data TEXT NOT NULL,
  document_format TEXT NOT NULL DEFAULT 'application/octet-stream',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_decrypted_video_cache_message_id ON public.decrypted_video_cache(message_id);
CREATE INDEX IF NOT EXISTS idx_decrypted_video_cache_expires_at ON public.decrypted_video_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_decrypted_document_cache_message_id ON public.decrypted_document_cache(message_id);
CREATE INDEX IF NOT EXISTS idx_decrypted_document_cache_expires_at ON public.decrypted_document_cache(expires_at);

-- Função para buscar vídeo descriptografado
CREATE OR REPLACE FUNCTION public.get_decrypted_video(p_message_id TEXT)
RETURNS TABLE(decrypted_data TEXT, video_format TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT dvc.decrypted_data, dvc.video_format
  FROM public.decrypted_video_cache dvc
  WHERE dvc.message_id = p_message_id
  AND dvc.expires_at > now();
END;
$$;

-- Função para buscar documento descriptografado
CREATE OR REPLACE FUNCTION public.get_decrypted_document(p_message_id TEXT)
RETURNS TABLE(decrypted_data TEXT, document_format TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT ddc.decrypted_data, ddc.document_format
  FROM public.decrypted_document_cache ddc
  WHERE ddc.message_id = p_message_id
  AND ddc.expires_at > now();
END;
$$;

-- Função para limpar cache de vídeos expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_decrypted_videos()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM public.decrypted_video_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$$;

-- Função para limpar cache de documentos expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_decrypted_documents()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM public.decrypted_document_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$$;