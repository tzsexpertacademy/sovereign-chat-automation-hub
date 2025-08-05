-- CORREÇÃO: Função RPC para gerenciar batch com timeout inteligente de 4 segundos
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
  v_last_updated timestamp with time zone;
  v_timeout_seconds integer := 4; -- 4 segundos para texto
  v_message_type text;
  v_content text;
BEGIN
  -- Extrair tipo e conteúdo da mensagem
  v_content := COALESCE(p_message->>'content', '');
  v_message_type := COALESCE(p_message->>'messageType', 'text');
  
  -- DETERMINAR TIMEOUT BASEADO NO TIPO DE CONTEÚDO
  IF v_message_type = 'audio' OR v_content ILIKE '%🎵 Áudio%' THEN
    v_timeout_seconds := 10; -- 10s para áudio
  ELSIF v_message_type = 'image' OR v_content ILIKE '%📷 Imagem%' THEN
    v_timeout_seconds := 10; -- 10s para imagem
  ELSIF v_content ~* 'vou.*(enviar|mandar).*(imagem|áudio)|analise.*(imagem|áudio).*que.*vou|mando.*(imagem|áudio)|próxima.*(imagem|áudio)' THEN
    v_timeout_seconds := 12; -- 12s para comandos de mídia futura
  ELSE
    v_timeout_seconds := 4; -- 4s para texto simples
  END IF;
  
  -- VERIFICAR SE EXISTE BATCH RECENTE (dentro da janela temporal)
  SELECT id, messages, last_updated INTO v_batch_id, v_existing_messages, v_last_updated
  FROM public.message_batches
  WHERE chat_id = p_chat_id 
    AND client_id = p_client_id
    AND processing_started_at IS NULL
    AND last_updated > (NOW() - INTERVAL '1 second' * v_timeout_seconds) -- Dentro da janela temporal
  FOR UPDATE SKIP LOCKED;

  IF v_batch_id IS NOT NULL THEN
    -- RESETAR JANELA TEMPORAL: Atualizar batch existente e estender tempo
    v_updated_messages := coalesce(v_existing_messages, '[]'::jsonb) || jsonb_build_array(p_message);
    
    UPDATE public.message_batches 
    SET 
      messages = v_updated_messages,
      last_updated = now() -- RESETAR TIMER
    WHERE id = v_batch_id;
    
    v_message_count := jsonb_array_length(v_updated_messages);
    
    RAISE LOG '[BATCH-RPC] ♻️ Batch atualizado (timer resetado): % mensagens, timeout: %s', v_message_count, v_timeout_seconds;
  ELSE
    -- CRIAR NOVO BATCH: janela temporal expirou ou não existe batch
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
    
    RAISE LOG '[BATCH-RPC] ✨ Novo batch criado: % (timeout: %s)', v_batch_id, v_timeout_seconds;
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'is_new_batch', v_is_new_batch,
    'message_count', v_message_count,
    'timeout_seconds', v_timeout_seconds
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[BATCH-RPC] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;