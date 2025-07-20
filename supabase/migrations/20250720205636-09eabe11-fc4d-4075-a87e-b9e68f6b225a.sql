
-- Adicionar campos de personalização na tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{"primary": "#3B82F6", "secondary": "#10B981", "accent": "#8B5CF6"}'::jsonb,
ADD COLUMN IF NOT EXISTS custom_theme JSONB DEFAULT '{"sidebar_bg": "#FFFFFF", "header_bg": "#FFFFFF", "text_primary": "#1F2937", "text_secondary": "#6B7280"}'::jsonb;

-- Criar bucket para assets dos clientes
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket client-assets
CREATE POLICY "Clients can upload their own assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-assets' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Clients can view their own assets" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-assets'
  );

CREATE POLICY "Clients can update their own assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'client-assets' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Clients can delete their own assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-assets' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Public access to client assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-assets');
