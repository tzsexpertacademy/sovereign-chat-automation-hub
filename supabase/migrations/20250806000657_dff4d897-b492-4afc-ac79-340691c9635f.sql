-- Corrigir a função para evitar warnings de segurança
DROP FUNCTION IF EXISTS public.sync_ticket_stage_tags();

CREATE OR REPLACE FUNCTION public.sync_ticket_stage_tags()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Quando um estágio é atribuído, adicionar a tag correspondente se existir
  IF NEW.current_stage_id IS NOT NULL AND (OLD.current_stage_id IS NULL OR NEW.current_stage_id != OLD.current_stage_id) THEN
    -- Adicionar tag do estágio se não existir
    UPDATE public.conversation_tickets 
    SET tags = CASE 
      WHEN tags IS NULL OR tags = '[]'::jsonb THEN 
        jsonb_build_array((SELECT name FROM public.funnel_stages WHERE id = NEW.current_stage_id))
      WHEN NOT tags ? (SELECT name FROM public.funnel_stages WHERE id = NEW.current_stage_id) THEN
        tags || jsonb_build_array((SELECT name FROM public.funnel_stages WHERE id = NEW.current_stage_id))
      ELSE tags
    END
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para sincronizar automaticamente
CREATE TRIGGER sync_ticket_stage_tags_trigger
  AFTER UPDATE OF current_stage_id ON public.conversation_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ticket_stage_tags();