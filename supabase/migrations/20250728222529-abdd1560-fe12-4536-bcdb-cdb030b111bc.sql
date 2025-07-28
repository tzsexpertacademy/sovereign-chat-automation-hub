-- Limpar memória conversacional contaminada e corrigir atribuição do ticket
UPDATE conversation_context 
SET conversation_summary = 'Nova conversa iniciada',
    key_information = '{}',
    last_topics = '[]',
    updated_at = now()
WHERE chat_id = '554796451886@s.whatsapp.net' 
  AND instance_id = '01K11NBE1QB0GVFMME8NA4YPCB'
  AND client_id = '35f36a03-39b2-412c-bba6-01fdd45c2dd3';

-- Atribuir o ticket à fila correta (Fila 1 - Yumer)
UPDATE conversation_tickets 
SET assigned_queue_id = '4af9dda2-a15d-42ea-a7df-67304a3c4680',
    updated_at = now()
WHERE id = '9d9774b8-2e96-446f-bb92-7ff05f84def5';

-- Registrar a correção nos eventos do ticket
INSERT INTO ticket_events (ticket_id, event_type, description, created_by, metadata)
VALUES (
  '9d9774b8-2e96-446f-bb92-7ff05f84def5',
  'queue_assignment', 
  'Ticket corrigido: atribuído à Fila 1 - Yumer e contexto conversacional limpo',
  'system',
  '{"queue_id": "4af9dda2-a15d-42ea-a7df-67304a3c4680", "action": "manual_correction"}'
);

-- Adicionar trigger para limpeza automática de contexto quando tickets são excluídos
CREATE OR REPLACE FUNCTION cleanup_conversation_context_on_ticket_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Limpar contexto conversacional quando ticket é excluído
  DELETE FROM conversation_context 
  WHERE chat_id = OLD.chat_id 
    AND instance_id = OLD.instance_id 
    AND client_id = OLD.client_id;
    
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_cleanup_context_on_ticket_delete ON conversation_tickets;
CREATE TRIGGER trigger_cleanup_context_on_ticket_delete
  AFTER DELETE ON conversation_tickets
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_conversation_context_on_ticket_delete();