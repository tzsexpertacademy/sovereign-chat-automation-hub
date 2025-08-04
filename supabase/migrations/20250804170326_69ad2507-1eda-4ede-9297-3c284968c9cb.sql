-- Criar função RPC para gerenciar batch de mensagens com controle de concorrência
CREATE OR REPLACE FUNCTION public.manage_message_batch(
  p_chat_id text,
  p_client_id uuid,
  p_instance_id text,
  p_message jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_batch_id uuid;
  v_existing_messages jsonb;
  v_updated_messages jsonb;
  v_is_new_batch boolean := false;
  v_message_count integer;
BEGIN
  -- Tentar encontrar batch existente não processado
  SELECT id, messages INTO v_batch_id, v_existing_messages
  FROM public.message_batches
  WHERE chat_id = p_chat_id 
    AND client_id = p_client_id
    AND processing_started_at IS NULL
  FOR UPDATE SKIP LOCKED; -- Evitar deadlocks

  IF v_batch_id IS NOT NULL THEN
    -- Atualizar batch existente
    v_updated_messages := coalesce(v_existing_messages, '[]'::jsonb) || jsonb_build_array(p_message);
    
    UPDATE public.message_batches 
    SET 
      messages = v_updated_messages,
      last_updated = now()
    WHERE id = v_batch_id;
    
    v_message_count := jsonb_array_length(v_updated_messages);
    
    RAISE LOG '[BATCH-RPC] ♻️ Batch atualizado: % mensagens', v_message_count;
  ELSE
    -- Criar novo batch
    INSERT INTO public.message_batches (
      chat_id, 
      client_id, 
      instance_id, 
      messages
    ) VALUES (
      p_chat_id, 
      p_client_id, 
      p_instance_id, 
      jsonb_build_array(p_message)
    ) RETURNING id INTO v_batch_id;
    
    v_is_new_batch := true;
    v_message_count := 1;
    
    RAISE LOG '[BATCH-RPC] ✨ Novo batch criado: %', v_batch_id;
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'is_new_batch', v_is_new_batch,
    'message_count', v_message_count
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[BATCH-RPC] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;