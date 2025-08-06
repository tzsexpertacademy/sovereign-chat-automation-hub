-- Adicionar coluna current_stage_id à tabela conversation_tickets
ALTER TABLE public.conversation_tickets 
ADD COLUMN current_stage_id UUID REFERENCES public.funnel_stages(id);

-- Criar índice para melhor performance
CREATE INDEX idx_conversation_tickets_current_stage_id 
ON public.conversation_tickets(current_stage_id);

-- Criar função para sincronizar estágio com tags
CREATE OR REPLACE FUNCTION public.sync_ticket_stage_tags()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando um estágio é atribuído, adicionar a tag correspondente se existir
  IF NEW.current_stage_id IS NOT NULL AND NEW.current_stage_id != OLD.current_stage_id THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;