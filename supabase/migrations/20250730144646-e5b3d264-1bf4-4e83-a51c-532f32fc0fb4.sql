-- Criar tabela media_cache para cache de mídias processadas
CREATE TABLE public.media_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso ao cache (sistema pode ler/escrever)
CREATE POLICY "Sistema pode acessar cache de mídias" 
ON public.media_cache 
FOR ALL 
USING (true);

-- Índices para melhor performance
CREATE INDEX idx_media_cache_message_id ON public.media_cache(message_id);
CREATE INDEX idx_media_cache_expires_at ON public.media_cache(expires_at);
CREATE INDEX idx_media_cache_media_type ON public.media_cache(media_type);

-- Função para limpeza automática de cache expirado
CREATE OR REPLACE FUNCTION public.cleanup_expired_media_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM public.media_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$$;