-- 🚨 CORREÇÃO EMERGENCIAL COMPLETA - REATIVAR FLUXO DE MENSAGENS 🚨

-- 1. LIMPAR LOCKS DE PROCESSAMENTO
UPDATE public.message_batches 
SET processing_started_at = NULL, 
    processing_by = NULL
WHERE processing_started_at IS NOT NULL;

-- 2. MARCAR MENSAGENS RECENTES COMO NÃO PROCESSADAS (desde 21:08:52)
UPDATE public.whatsapp_messages 
SET is_processed = false,
    processing_started_at = NULL,
    processed_at = NULL
WHERE created_at >= '2025-08-04 21:08:52+00'
  AND is_processed = true;

-- 3. DELETAR BATCHES ÓRFÃOS PARA REPROCESSAMENTO
DELETE FROM public.message_batches 
WHERE created_at >= '2025-08-04 21:08:52+00';

-- 4. RESETAR TENTATIVAS DE PROCESSAMENTO IA
UPDATE public.conversation_tickets 
SET ai_processing_attempts = 0
WHERE updated_at >= '2025-08-04 21:08:52+00';

-- 5. CRIAR FUNÇÃO DE RECUPERAÇÃO DE MENSAGENS
CREATE OR REPLACE FUNCTION public.emergency_message_recovery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_recovered_count INTEGER := 0;
  v_batch_count INTEGER := 0;
  v_message RECORD;
  v_batch_id UUID;
BEGIN
  -- Processar mensagens não processadas uma por uma
  FOR v_message IN 
    SELECT wm.*
    FROM public.whatsapp_messages wm
    WHERE wm.is_processed = false
      AND wm.created_at >= '2025-08-04 21:08:52+00'
    ORDER BY wm.created_at ASC
  LOOP
    -- Criar batch emergencial para cada mensagem
    IF NOT v_message.from_me THEN
      INSERT INTO public.message_batches (
        chat_id,
        client_id,
        instance_id,
        messages,
        created_at
      ) VALUES (
        v_message.chat_id,
        v_message.client_id,
        (SELECT instance_id FROM public.whatsapp_instances WHERE instance_id = v_message.chat_id LIMIT 1),
        jsonb_build_array(
          jsonb_build_object(
            'messageId', v_message.message_id,
            'chatId', v_message.chat_id,
            'content', v_message.body,
            'fromMe', v_message.from_me,
            'timestamp', EXTRACT(EPOCH FROM v_message.timestamp) * 1000
          )
        ),
        v_message.created_at
      );
      
      v_batch_count := v_batch_count + 1;
    END IF;
    
    -- Marcar como processada
    UPDATE public.whatsapp_messages 
    SET is_processed = true,
        processed_at = now()
    WHERE id = v_message.id;
    
    v_recovered_count := v_recovered_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'recovered_messages', v_recovered_count,
    'created_batches', v_batch_count,
    'timestamp', now()
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', now()
  );
END;
$function$;

-- 6. CRIAR FUNÇÃO DE MONITORAMENTO CONTÍNUO
CREATE OR REPLACE FUNCTION public.monitor_message_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'unprocessed_messages', (
      SELECT COUNT(*) 
      FROM public.whatsapp_messages 
      WHERE is_processed = false
    ),
    'pending_batches', (
      SELECT COUNT(*) 
      FROM public.message_batches 
      WHERE processing_started_at IS NULL
    ),
    'stuck_batches', (
      SELECT COUNT(*) 
      FROM public.message_batches 
      WHERE processing_started_at IS NOT NULL 
        AND processing_started_at < now() - interval '5 minutes'
    ),
    'recent_messages_1h', (
      SELECT COUNT(*) 
      FROM public.whatsapp_messages 
      WHERE created_at >= now() - interval '1 hour'
    ),
    'recent_tickets_1h', (
      SELECT COUNT(*) 
      FROM public.conversation_tickets 
      WHERE updated_at >= now() - interval '1 hour'
    ),
    'last_webhook_activity', (
      SELECT MAX(created_at) 
      FROM public.whatsapp_messages
    )
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$function$;