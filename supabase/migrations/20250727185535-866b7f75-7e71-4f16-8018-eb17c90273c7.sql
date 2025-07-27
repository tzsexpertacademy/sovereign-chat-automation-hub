-- Habilitar RLS nas novas tabelas de cache
ALTER TABLE public.decrypted_video_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decrypted_document_cache ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para acesso ao sistema
CREATE POLICY "Sistema pode acessar cache de vídeos" 
ON public.decrypted_video_cache 
FOR ALL 
USING (true);

CREATE POLICY "Sistema pode acessar cache de documentos" 
ON public.decrypted_document_cache 
FOR ALL 
USING (true);