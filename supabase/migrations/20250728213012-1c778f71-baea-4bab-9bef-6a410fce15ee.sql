-- Adicionar controle de concorrência para evitar duplicação de processamento

-- Adicionar campo para controle de processamento concorrente
ALTER TABLE message_batches 
ADD COLUMN IF NOT EXISTS processing_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processing_by text DEFAULT NULL;

-- Criar índice para otimizar consultas de controle de concorrência
CREATE INDEX IF NOT EXISTS idx_message_batches_processing 
ON message_batches (processing_started_at, processing_by) 
WHERE processing_started_at IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN message_batches.processing_started_at IS 'Timestamp quando o processamento do batch foi iniciado para evitar duplicação';
COMMENT ON COLUMN message_batches.processing_by IS 'Identificador do processo que está processando o batch (scheduler ou hybrid_direct)';
COMMENT ON INDEX idx_message_batches_processing IS 'Otimiza verificação de batches em processamento para evitar duplicação';