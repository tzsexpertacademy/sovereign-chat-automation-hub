-- Criar tabela de cache para imagens descriptografadas do WhatsApp
CREATE TABLE public.decrypted_image_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  decrypted_data TEXT NOT NULL,
  image_format TEXT NOT NULL DEFAULT 'jpeg',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.decrypted_image_cache ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (apenas funções do sistema podem acessar)
CREATE POLICY "Sistema pode acessar cache de imagens"
ON public.decrypted_image_cache
FOR ALL
TO service_role
USING (true);

-- Índices para performance
CREATE INDEX idx_decrypted_image_cache_message_id ON public.decrypted_image_cache(message_id);
CREATE INDEX idx_decrypted_image_cache_expires_at ON public.decrypted_image_cache(expires_at);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_decrypted_image_cache_updated_at
BEFORE UPDATE ON public.decrypted_image_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para limpeza automática de imagens expiradas
CREATE OR REPLACE FUNCTION public.cleanup_expired_decrypted_images()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  DELETE FROM public.decrypted_image_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$$;

-- Função para obter imagem descriptografada
CREATE OR REPLACE FUNCTION public.get_decrypted_image(p_message_id text)
RETURNS TABLE(decrypted_data text, image_format text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT dic.decrypted_data, dic.image_format
  FROM public.decrypted_image_cache dic
  WHERE dic.message_id = p_message_id
  AND dic.expires_at > now();
END;
$$;