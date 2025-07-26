-- Habilitar RLS na tabela decrypted_audio_cache
ALTER TABLE public.decrypted_audio_cache ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir acesso aos áudios descriptografados
-- (sem restrição de usuário pois é cache temporário baseado em message_id)
CREATE POLICY "Allow access to decrypted audio cache"
ON public.decrypted_audio_cache
FOR ALL
USING (true);

-- Criar função para buscar áudio descriptografado
CREATE OR REPLACE FUNCTION public.get_decrypted_audio(p_message_id TEXT)
RETURNS TABLE(decrypted_data TEXT, audio_format TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT dac.decrypted_data, dac.audio_format
  FROM public.decrypted_audio_cache dac
  WHERE dac.message_id = p_message_id
  AND dac.expires_at > now();
END;
$function$;