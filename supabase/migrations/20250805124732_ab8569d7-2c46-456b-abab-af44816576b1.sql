-- Corrigir trigger para funcionar em ambos os cenários (cliente e assistente)
DROP TRIGGER IF EXISTS trigger_auto_handoff ON public.ticket_messages;
CREATE TRIGGER trigger_auto_handoff
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  WHEN (NEW.content IS NOT NULL AND NEW.content != '')
  EXECUTE FUNCTION public.auto_process_handoff_triggers();