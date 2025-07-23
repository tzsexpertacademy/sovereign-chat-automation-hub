
-- Criar tabela para coleções de produtos
CREATE TABLE public.business_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para produtos
CREATE TABLE public.business_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id TEXT NOT NULL,
  collection_id UUID REFERENCES public.business_collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'BRL',
  sku TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  images JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.business_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_products ENABLE ROW LEVEL SECURITY;

-- Políticas para coleções
CREATE POLICY "Business owners can manage their collections" 
  ON public.business_collections 
  FOR ALL 
  USING (true);

-- Políticas para produtos
CREATE POLICY "Business owners can manage their products" 
  ON public.business_products 
  FOR ALL 
  USING (true);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_business_collections_updated_at
  BEFORE UPDATE ON public.business_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_products_updated_at
  BEFORE UPDATE ON public.business_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_business_collections_business_id ON public.business_collections(business_id);
CREATE INDEX idx_business_products_business_id ON public.business_products(business_id);
CREATE INDEX idx_business_products_collection_id ON public.business_products(collection_id);
