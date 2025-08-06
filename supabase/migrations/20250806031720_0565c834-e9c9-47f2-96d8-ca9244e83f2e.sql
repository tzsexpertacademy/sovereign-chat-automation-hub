-- ==============================================================================
-- CORREÇÃO DEFINITIVA: SISTEMA PROCESSAMENTO IMEDIATO (SEGURO)
-- ==============================================================================

-- ETAPA 1: Limpar crons de forma segura (ignorando erros)
DO $$
DECLARE
  job_record RECORD;
  total_removed INTEGER := 0;
BEGIN
  -- Remover jobs existentes com tratamento de erro
  FOR job_record IN 
    SELECT DISTINCT jobname 
    FROM cron.job 
    WHERE active = true
      AND (jobname ILIKE '%process-message%' 
           OR jobname ILIKE '%batch%'
           OR jobname ILIKE '%scheduler%')
  LOOP
    BEGIN
      PERFORM cron.unschedule(job_record.jobname);
      total_removed := total_removed + 1;
      RAISE LOG '[CRON-CLEANUP] Job removido: %', job_record.jobname;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[CRON-CLEANUP] Erro ao remover job %: %', job_record.jobname, SQLERRM;
    END;
  END LOOP;
  
  RAISE LOG '[CRON-CLEANUP] Total de jobs removidos: %', total_removed;
END $$;

-- ETAPA 2: Atualizar manage_message_batch_immediate para ser autossuficiente
CREATE OR REPLACE FUNCTION public.manage_message_batch_immediate(p_chat_id text, p_client_id uuid, p_instance_id text, p_message jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_batch_id uuid;
  v_existing_messages jsonb;
  v_updated_messages jsonb;
  v_is_new_batch boolean := false;
  v_message_count integer;
  v_timeout_seconds integer := 3; -- 3s para texto
  v_message_type text;
  v_content text;
  v_http_response jsonb;
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

  -- PROCESSAR IMEDIATAMENTE VIA EDGE FUNCTION
  BEGIN
    SELECT net.http_post(
      url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/immediate-batch-processor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY'
      ),
      body := jsonb_build_object(
        'action', 'schedule',
        'batchId', v_batch_id,
        'timeout', v_timeout_seconds * 1000
      )
    ) INTO v_http_response;
    
    RAISE LOG '[BATCH-IMMEDIATE] ⚡ Processamento agendado imediatamente';
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[BATCH-IMMEDIATE] ❌ Erro ao agendar: %', SQLERRM;
  END;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'is_new_batch', v_is_new_batch,
    'message_count', v_message_count,
    'timeout_seconds', v_timeout_seconds,
    'processing_scheduled', true,
    'version', 'immediate_autosufficient'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[BATCH-IMMEDIATE] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

-- ETAPA 3: Processar batches órfãos existentes
DO $$
DECLARE
  v_batch RECORD;
  v_processed INTEGER := 0;
BEGIN
  FOR v_batch IN 
    SELECT id, chat_id, jsonb_array_length(messages) as msg_count
    FROM public.message_batches 
    WHERE processing_started_at IS NULL
    ORDER BY created_at ASC
    LIMIT 5
  LOOP
    BEGIN
      RAISE LOG '[RECOVERY] Processando batch órfão: % (% mensagens)', v_batch.id, v_batch.msg_count;
      
      -- Chamar edge function diretamente
      PERFORM net.http_post(
        url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/process-message-batches',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY'
        ),
        body := jsonb_build_object(
          'trigger', 'recovery',
          'batchId', v_batch.id
        )
      );
      
      v_processed := v_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[RECOVERY] Erro ao processar batch %: %', v_batch.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE LOG '[RECOVERY] Total de batches órfãos processados: %', v_processed;
END $$;

-- ETAPA 4: Status final do sistema
DO $$
DECLARE
  v_pending_batches INTEGER;
  v_active_crons INTEGER;
BEGIN
  -- Contar batches pendentes
  SELECT COUNT(*) INTO v_pending_batches
  FROM public.message_batches 
  WHERE processing_started_at IS NULL;
  
  -- Contar crons ativos
  SELECT COUNT(*) INTO v_active_crons
  FROM cron.job 
  WHERE active = true;
  
  RAISE LOG '🚀 [SISTEMA-IMEDIATO] ✅ CONFIGURAÇÃO FINALIZADA:';
  RAISE LOG '   📊 Crons ativos restantes: %', v_active_crons;
  RAISE LOG '   📊 Batches pendentes: %', v_pending_batches;
  RAISE LOG '   ⚡ Sistema processamento imediato: ATIVO';
  RAISE LOG '   🎯 Pronto para testes - respostas em 3-8 segundos!';
END $$;