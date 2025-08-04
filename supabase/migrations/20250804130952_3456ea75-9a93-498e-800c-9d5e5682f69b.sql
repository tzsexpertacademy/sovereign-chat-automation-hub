-- Criar tabela para biblioteca de vídeos dos assistentes
CREATE TABLE public.assistant_video_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assistant_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  trigger_phrase TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_seconds INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_assistant_video_library_assistant_id ON public.assistant_video_library(assistant_id);
CREATE INDEX idx_assistant_video_library_trigger ON public.assistant_video_library(trigger_phrase);
CREATE INDEX idx_assistant_video_library_category ON public.assistant_video_library(category);

-- Habilitar RLS
ALTER TABLE public.assistant_video_library ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Clientes podem gerenciar vídeos de seus assistentes"
ON public.assistant_video_library
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.assistants a 
    WHERE a.id = assistant_video_library.assistant_id 
    AND a.client_id = (
      SELECT client_id FROM public.clients WHERE id::text = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  )
);

-- Criar bucket de storage para vídeos se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assistant-videos', 
  'assistant-videos', 
  false,
  104857600, -- 100MB limit
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas de storage
CREATE POLICY "Clientes podem fazer upload de vídeos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'assistant-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clientes podem visualizar seus vídeos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'assistant-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Clientes podem deletar seus vídeos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'assistant-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_assistant_video_library_updated_at
  BEFORE UPDATE ON public.assistant_video_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();