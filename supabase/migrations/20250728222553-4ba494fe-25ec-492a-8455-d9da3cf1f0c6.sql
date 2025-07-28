-- Corrigir função com search_path para segurança
CREATE OR REPLACE FUNCTION cleanup_conversation_context_on_ticket_delete()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Limpar contexto conversacional quando ticket é excluído
  DELETE FROM public.conversation_context 
  WHERE chat_id = OLD.chat_id 
    AND instance_id = OLD.instance_id 
    AND client_id = OLD.client_id;
    
  RETURN OLD;
END;
$$;