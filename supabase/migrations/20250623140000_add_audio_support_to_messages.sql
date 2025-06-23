
-- Adicionar colunas para suporte a áudio nas mensagens
ALTER TABLE ticket_messages 
ADD COLUMN IF NOT EXISTS audio_base64 TEXT,
ADD COLUMN IF NOT EXISTS media_transcription TEXT,
ADD COLUMN IF NOT EXISTS media_duration INTEGER;

-- Índice para buscas por mensagens com áudio
CREATE INDEX IF NOT EXISTS idx_ticket_messages_audio 
ON ticket_messages(message_type) 
WHERE message_type = 'audio';

-- Índice para buscas por transcrições
CREATE INDEX IF NOT EXISTS idx_ticket_messages_transcription 
ON ticket_messages(media_transcription) 
WHERE media_transcription IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN ticket_messages.audio_base64 IS 'Dados do áudio em base64 para reprodução na interface';
COMMENT ON COLUMN ticket_messages.media_transcription IS 'Transcrição do áudio feita pelo Whisper';
COMMENT ON COLUMN ticket_messages.media_duration IS 'Duração do áudio em segundos';
