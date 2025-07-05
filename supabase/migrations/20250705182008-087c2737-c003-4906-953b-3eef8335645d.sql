-- Adicionar campo para controle de expiração do QR Code
ALTER TABLE public.whatsapp_instances 
ADD COLUMN qr_expires_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para limpeza de QR codes expirados
CREATE INDEX idx_whatsapp_instances_qr_expires 
ON public.whatsapp_instances(qr_expires_at) 
WHERE qr_expires_at IS NOT NULL;

-- Função para limpar QR codes expirados
CREATE OR REPLACE FUNCTION public.cleanup_expired_qr_codes()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  UPDATE public.whatsapp_instances 
  SET 
    qr_code = NULL,
    has_qr_code = false,
    qr_expires_at = NULL,
    status = CASE 
      WHEN status = 'qr_ready' THEN 'disconnected'
      ELSE status
    END,
    updated_at = now()
  WHERE qr_expires_at IS NOT NULL 
    AND qr_expires_at < now();
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  RETURN cleanup_count;
END;
$$;