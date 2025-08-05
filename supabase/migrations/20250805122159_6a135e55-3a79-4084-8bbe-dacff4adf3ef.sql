-- FASE 1: REMOVER LIMITAÇÕES DESNECESSÁRIAS
-- Aumentar limite de tickets por fila de 10 para 1000 (praticamente ilimitado)
UPDATE public.queues 
SET max_concurrent_tickets = 1000 
WHERE max_concurrent_tickets = 10;

-- FASE 2: IMPLEMENTAR SISTEMA DE GATILHOS FUNCIONAIS
-- Adicionar gatilho "atendimento humano" para transferir para fila 2
UPDATE public.queues 
SET handoff_triggers = jsonb_build_array(
  jsonb_build_object(
    'keywords', jsonb_build_array('atendimento humano', 'falar com humano', 'quero humano', 'atendente humano'),
    'action', 'transfer_to_queue',
    'target_queue_id', (SELECT id FROM public.queues WHERE name = 'Fila 2' LIMIT 1),
    'enabled', true,
    'priority', 1
  )
)
WHERE name = 'Fila 1';

-- Criar função para processamento automático de gatilhos
CREATE OR REPLACE FUNCTION public.process_handoff_triggers(
  p_message_content text,
  p_current_queue_id uuid,
  p_client_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_target_queue_id uuid;
  v_trigger jsonb;
  v_keyword text;
  v_message_lower text;
BEGIN
  -- Converter mensagem para minúsculo
  v_message_lower := lower(p_message_content);
  
  -- Buscar fila atual e seus gatilhos
  FOR v_trigger IN 
    SELECT jsonb_array_elements(handoff_triggers) as trigger
    FROM public.queues 
    WHERE id = p_current_queue_id 
      AND client_id = p_client_id
      AND is_active = true
  LOOP
    -- Verificar se o gatilho está habilitado
    IF (v_trigger->>'enabled')::boolean = true THEN
      -- Verificar cada palavra-chave
      FOR v_keyword IN 
        SELECT jsonb_array_elements_text(v_trigger->'keywords')
      LOOP
        IF v_message_lower LIKE '%' || lower(v_keyword) || '%' THEN
          -- Palavra-chave encontrada, retornar fila de destino
          v_target_queue_id := (v_trigger->>'target_queue_id')::uuid;
          
          RAISE LOG '[HANDOFF-TRIGGER] 🎯 Gatilho ativado: "%" → fila %', v_keyword, v_target_queue_id;
          
          RETURN v_target_queue_id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Nenhum gatilho ativado
  RETURN NULL;
END;
$function$;

-- Atualizar função auto_assign_queue para usar gatilhos
CREATE OR REPLACE FUNCTION public.auto_assign_queue(
  p_client_id uuid, 
  p_instance_id text, 
  p_message_content text DEFAULT ''::text,
  p_current_queue_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_queue_id UUID;
  v_triggered_queue_id UUID;
BEGIN
  -- PRIORIDADE 1: Verificar gatilhos de transferência se há fila atual
  IF p_current_queue_id IS NOT NULL AND p_message_content != '' THEN
    SELECT public.process_handoff_triggers(p_message_content, p_current_queue_id, p_client_id) 
    INTO v_triggered_queue_id;
    
    IF v_triggered_queue_id IS NOT NULL THEN
      RAISE LOG '[AUTO-ASSIGN] 🚀 Transferência por gatilho: % → %', p_current_queue_id, v_triggered_queue_id;
      RETURN v_triggered_queue_id;
    END IF;
  END IF;
  
  -- PRIORIDADE 2: Buscar fila ativa conectada à instância com menor carga
  SELECT q.id INTO v_queue_id
  FROM public.queues q
  JOIN public.instance_queue_connections iqc ON q.id = iqc.queue_id
  JOIN public.whatsapp_instances wi ON iqc.instance_id = wi.id
  WHERE q.client_id = p_client_id
    AND q.is_active = true
    AND iqc.is_active = true
    AND wi.instance_id = p_instance_id
    AND q.auto_assignment = true
  ORDER BY (
    SELECT COUNT(*) 
    FROM public.conversation_tickets ct 
    WHERE ct.assigned_queue_id = q.id 
    AND ct.status IN ('open', 'pending')
  ) ASC
  LIMIT 1;
  
  RAISE LOG '[AUTO-ASSIGN] 📋 Fila padrão atribuída: %', v_queue_id;
  
  RETURN v_queue_id;
END;
$function$;