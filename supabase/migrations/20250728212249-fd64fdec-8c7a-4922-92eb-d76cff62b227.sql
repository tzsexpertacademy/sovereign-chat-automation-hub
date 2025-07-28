-- Criar índices para otimizar performance das consultas mais frequentes

-- Índice para busca eficiente de batches pendentes
CREATE INDEX IF NOT EXISTS idx_message_batches_last_updated 
ON message_batches (last_updated);

-- Índice composto para busca rápida de tickets por chat/cliente
CREATE INDEX IF NOT EXISTS idx_conversation_tickets_chat_client 
ON conversation_tickets (chat_id, client_id, created_at DESC);

-- Índice para busca eficiente de mensagens de ticket por timestamp
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_timestamp 
ON ticket_messages (ticket_id, timestamp DESC);

-- Índice para busca rápida de contexto conversacional
CREATE INDEX IF NOT EXISTS idx_conversation_context_lookup 
ON conversation_context (client_id, chat_id, instance_id);

-- Índice para assistentes ativos por cliente
CREATE INDEX IF NOT EXISTS idx_assistants_active_client 
ON assistants (client_id, is_active, created_at DESC) 
WHERE is_active = true;

-- Índice para mensagens WhatsApp não processadas
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_unprocessed 
ON whatsapp_messages (is_processed, created_at DESC) 
WHERE is_processed = false;

-- Índice para cache de áudio descriptografado por message_id
CREATE INDEX IF NOT EXISTS idx_decrypted_audio_cache_message_expires 
ON decrypted_audio_cache (message_id, expires_at);

-- Comentário explicativo
COMMENT ON INDEX idx_message_batches_last_updated IS 'Otimiza busca de batches pendentes para processamento';
COMMENT ON INDEX idx_conversation_tickets_chat_client IS 'Acelera busca de tickets por chat e cliente';
COMMENT ON INDEX idx_ticket_messages_ticket_timestamp IS 'Melhora performance do histórico de mensagens';
COMMENT ON INDEX idx_conversation_context_lookup IS 'Otimiza busca de contexto conversacional';
COMMENT ON INDEX idx_assistants_active_client IS 'Acelera busca de assistentes ativos';
COMMENT ON INDEX idx_whatsapp_messages_unprocessed IS 'Otimiza busca de mensagens não processadas';
COMMENT ON INDEX idx_decrypted_audio_cache_message_expires IS 'Acelera busca no cache de áudio descriptografado';