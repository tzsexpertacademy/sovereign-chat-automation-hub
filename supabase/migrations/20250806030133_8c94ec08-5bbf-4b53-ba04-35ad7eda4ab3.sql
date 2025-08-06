-- Criar função RPC para processamento imediato de batches
CREATE OR REPLACE FUNCTION public.schedule_immediate_batch_processing(
  p_batch_id uuid,
  p_timeout_seconds integer DEFAULT 3
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_batch_exists boolean;
  v_timeout_ms integer;
BEGIN
  -- Verificar se batch existe
  SELECT EXISTS(
    SELECT 1 FROM public.message_batches 
    WHERE id = p_batch_id 
    AND processing_started_at IS NULL
  ) INTO v_batch_exists;
  
  IF NOT v_batch_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch não encontrado ou já processado'
    );
  END IF;
  
  -- Converter para milissegundos
  v_timeout_ms := p_timeout_seconds * 1000;
  
  -- Log do agendamento
  RAISE LOG '[SCHEDULE-BATCH] 🚀 Agendando processamento imediato: batch=% timeout=%ms', p_batch_id, v_timeout_ms;
  
  -- Chamar edge function para agendar processamento
  PERFORM net.http_post(
    url := format('%s/functions/v1/immediate-batch-processor', current_setting('app.supabase_url')),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', format('Bearer %s', current_setting('app.service_role_key'))
    ),
    body := jsonb_build_object(
      'action', 'schedule',
      'batchId', p_batch_id,
      'timeout', v_timeout_ms
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'timeout_ms', v_timeout_ms,
    'message', 'Processamento imediato agendado'
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[SCHEDULE-BATCH] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

-- Modificar função de gestão de batches para agendar processamento imediato
CREATE OR REPLACE FUNCTION public.manage_message_batch_immediate(
  p_chat_id text,
  p_client_id uuid,
  p_instance_id text,
  p_message jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_batch_id uuid;
  v_existing_messages jsonb;
  v_updated_messages jsonb;
  v_is_new_batch boolean := false;
  v_message_count integer;
  v_timeout_seconds integer := 3; -- NOVO PADRÃO: 3s para texto
  v_message_type text;
  v_content text;
  v_schedule_result jsonb;
BEGIN
  -- Extrair tipo e conteúdo da mensagem
  v_content := COALESCE(p_message->>'content', '');
  v_message_type := COALESCE(p_message->>'messageType', 'text');
  
  -- DETERMINAR TIMEOUT INTELIGENTE
  IF v_message_type = 'audio' OR v_content ILIKE '%🎵 Áudio%' THEN
    v_timeout_seconds := 8; -- 8s para áudio
  ELSIF v_message_type = 'image' OR v_content ILIKE '%📷 Imagem%' THEN
    v_timeout_seconds := 8; -- 8s para imagem
  ELSIF v_content ~* 'vou.*(enviar|mandar).*(imagem|áudio)|analise.*(imagem|áudio).*que.*vou|mando.*(imagem|áudio)|próxima.*(imagem|áudio)' THEN
    v_timeout_seconds := 10; -- 10s para comandos de mídia futura
  ELSE
    v_timeout_seconds := 3; -- 3s para texto simples
  END IF;
  
  -- VERIFICAR SE EXISTE BATCH RECENTE
  SELECT id, messages INTO v_batch_id, v_existing_messages
  FROM public.message_batches
  WHERE chat_id = p_chat_id 
    AND client_id = p_client_id
    AND processing_started_at IS NULL
    AND last_updated > (NOW() - INTERVAL '1 second' * v_timeout_seconds)
  FOR UPDATE SKIP LOCKED;

  IF v_batch_id IS NOT NULL THEN
    -- ATUALIZAR BATCH EXISTENTE
    v_updated_messages := coalesce(v_existing_messages, '[]'::jsonb) || jsonb_build_array(p_message);
    
    UPDATE public.message_batches 
    SET 
      messages = v_updated_messages,
      last_updated = NOW()
    WHERE id = v_batch_id;
    
    v_message_count := jsonb_array_length(v_updated_messages);
    
    RAISE LOG '[BATCH-IMMEDIATE] ♻️ Batch atualizada: % mensagens, timeout: %s', v_message_count, v_timeout_seconds;
    
    -- CANCELAR AGENDAMENTO ANTERIOR E CRIAR NOVO
    PERFORM net.http_post(
      url := format('%s/functions/v1/immediate-batch-processor', current_setting('app.supabase_url')),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', format('Bearer %s', current_setting('app.service_role_key'))
      ),
      body := jsonb_build_object(
        'action', 'cancel',
        'batchId', v_batch_id
      )
    );
    
  ELSE
    -- CRIAR NOVO BATCH
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
    
    RAISE LOG '[BATCH-IMMEDIATE] ✨ Novo batch criado: % (timeout: %s)', v_batch_id, v_timeout_seconds;
  END IF;

  -- AGENDAR PROCESSAMENTO IMEDIATO
  SELECT public.schedule_immediate_batch_processing(v_batch_id, v_timeout_seconds) INTO v_schedule_result;
  
  IF NOT (v_schedule_result->>'success')::boolean THEN
    RAISE LOG '[BATCH-IMMEDIATE] ❌ Falha ao agendar processamento: %', v_schedule_result->>'error';
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'is_new_batch', v_is_new_batch,
    'message_count', v_message_count,
    'timeout_seconds', v_timeout_seconds,
    'processing_scheduled', (v_schedule_result->>'success')::boolean,
    'version', 'immediate'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[BATCH-IMMEDIATE] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;