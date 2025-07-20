-- Verificar se o bucket existe e recriar com configurações corretas
DELETE FROM storage.buckets WHERE id = 'client-assets';

INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-assets', 'client-assets', true);

-- Remover políticas antigas
DROP POLICY IF EXISTS "Clients can upload their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Clients can view their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Clients can update their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Clients can delete their own assets" ON storage.objects;
DROP POLICY IF EXISTS "Public access to client assets" ON storage.objects;

-- Criar políticas mais permissivas para debug
CREATE POLICY "Anyone can upload to client-assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'client-assets');

CREATE POLICY "Anyone can view client-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-assets');

CREATE POLICY "Anyone can update client-assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'client-assets');

CREATE POLICY "Anyone can delete client-assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'client-assets');