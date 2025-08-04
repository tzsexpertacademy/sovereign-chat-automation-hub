-- Corrigir as políticas RLS para funcionar com o sistema atual
DROP POLICY IF EXISTS "Clientes podem gerenciar vídeos de seus assistentes" ON public.assistant_video_library;

-- Criar política mais simples que permita todas as operações
CREATE POLICY "Permitir acesso completo à biblioteca de vídeos"
ON public.assistant_video_library
FOR ALL
USING (true)
WITH CHECK (true);

-- Corrigir políticas de storage também
DROP POLICY IF EXISTS "Clientes podem fazer upload de vídeos" ON storage.objects;
DROP POLICY IF EXISTS "Clientes podem visualizar seus vídeos" ON storage.objects;
DROP POLICY IF EXISTS "Clientes podem deletar seus vídeos" ON storage.objects;

-- Criar políticas de storage mais simples
CREATE POLICY "Permitir upload de vídeos assistentes"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'assistant-videos');

CREATE POLICY "Permitir visualização de vídeos assistentes"
ON storage.objects
FOR SELECT
USING (bucket_id = 'assistant-videos');

CREATE POLICY "Permitir deleção de vídeos assistentes"
ON storage.objects
FOR DELETE
USING (bucket_id = 'assistant-videos');