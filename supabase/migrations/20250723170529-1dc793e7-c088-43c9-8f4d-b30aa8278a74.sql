-- Adicionar coluna business_id na tabela clients para relação 1:1
ALTER TABLE public.clients 
ADD COLUMN business_id TEXT,
ADD COLUMN business_token TEXT;

-- Criar índice para melhor performance
CREATE INDEX idx_clients_business_id ON public.clients(business_id);

-- Comentários nas colunas
COMMENT ON COLUMN public.clients.business_id IS 'ID do business no servidor Yumer (relação 1:1)';
COMMENT ON COLUMN public.clients.business_token IS 'Token do business no servidor Yumer';