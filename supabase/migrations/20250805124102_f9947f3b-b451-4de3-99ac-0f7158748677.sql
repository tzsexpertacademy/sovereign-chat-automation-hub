-- Criar trigger automático para detectar gatilhos de transferência
CREATE OR REPLACE FUNCTION public.auto_process_handoff_triggers()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket_id UUID;
  v_current_queue_id UUID;
  v_client_id UUID;
  v_target_queue_id UUID;
BEGIN
  -- Buscar informações do ticket
  SELECT ct.id, ct.assigned_queue_id, ct.client_id
  INTO v_ticket_id, v_current_queue_id, v_client_id
  FROM public.conversation_tickets ct
  WHERE ct.id = NEW.ticket_id;
  
  -- Se não há fila atual, não processar
  IF v_current_queue_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar se há gatilhos para transferência
  SELECT public.process_handoff_triggers(NEW.content, v_current_queue_id, v_client_id) 
  INTO v_target_queue_id;
  
  -- Se encontrou fila de destino, fazer transferência
  IF v_target_queue_id IS NOT NULL AND v_target_queue_id != v_current_queue_id THEN
    -- Atualizar fila do ticket
    UPDATE public.conversation_tickets 
    SET 
      assigned_queue_id = v_target_queue_id,
      updated_at = NOW()
    WHERE id = v_ticket_id;
    
    -- Registrar transferência
    INSERT INTO public.queue_transfers (
      ticket_id,
      from_queue_id,
      to_queue_id,
      transfer_reason,
      transfer_type,
      initiated_by
    ) VALUES (
      v_ticket_id,
      v_current_queue_id,
      v_target_queue_id,
      'Gatilho automático ativado: "' || NEW.content || '"',
      'automatic',
      'system'
    );
    
    RAISE LOG '🔄 [AUTO-HANDOFF] Ticket % transferido da fila % para fila % por gatilho', v_ticket_id, v_current_queue_id, v_target_queue_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Criar trigger que executa após inserção de mensagem
DROP TRIGGER IF EXISTS trigger_auto_handoff ON public.ticket_messages;
CREATE TRIGGER trigger_auto_handoff
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  WHEN (NEW.from_me = false AND NEW.content IS NOT NULL AND NEW.content != '')
  EXECUTE FUNCTION public.auto_process_handoff_triggers();