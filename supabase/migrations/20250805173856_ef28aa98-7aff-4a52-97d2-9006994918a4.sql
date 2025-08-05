-- ========================================
-- CORREÇÃO URGENTE DA LÓGICA DE TIMING
-- Limpeza de batches órfãos e sincronização
-- ========================================

-- 1. Limpar batches órfãos (criados mas nunca processados há mais de 30 segundos)
DELETE FROM public.message_batches 
WHERE processing_started_at IS NULL 
  AND created_at < NOW() - INTERVAL '30 seconds'
  AND last_updated < NOW() - INTERVAL '30 seconds';

-- 2. Resetar batches travados em processamento há mais de 2 minutos
UPDATE public.message_batches 
SET 
  processing_started_at = NULL, 
  processing_by = NULL,
  last_updated = NOW()
WHERE processing_started_at IS NOT NULL 
  AND processing_started_at < NOW() - INTERVAL '2 minutes';

-- 3. Criar função para limpeza automática de batches órfãos
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_batches()
RETURNS INTEGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count INTEGER := 0;
BEGIN
  -- Limpar batches órfãos antigos (mais de 1 minuto sem processamento)
  DELETE FROM public.message_batches 
  WHERE processing_started_at IS NULL 
    AND created_at < NOW() - INTERVAL '1 minute'
    AND last_updated < NOW() - INTERVAL '1 minute';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Resetar batches travados há mais de 3 minutos
  UPDATE public.message_batches 
  SET 
    processing_started_at = NULL, 
    processing_by = NULL,
    last_updated = NOW()
  WHERE processing_started_at IS NOT NULL 
    AND processing_started_at < NOW() - INTERVAL '3 minutes';
    
  RETURN cleaned_count;
END;
$$;

-- 4. Função aprimorada para gerenciar batch com timeouts sincronizados
CREATE OR REPLACE FUNCTION public.manage_message_batch_v2(
  p_chat_id text, 
  p_client_id uuid, 
  p_instance_id text, 
  p_message jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id uuid;
  v_existing_messages jsonb;
  v_updated_messages jsonb;
  v_is_new_batch boolean := false;
  v_message_count integer;
  v_timeout_seconds integer := 3; -- NOVO PADRÃO: 3s para texto
  v_message_type text;
  v_content text;
BEGIN
  -- Extrair tipo e conteúdo da mensagem
  v_content := COALESCE(p_message->>'content', '');
  v_message_type := COALESCE(p_message->>'messageType', 'text');
  
  -- DETERMINAR TIMEOUT SINCRONIZADO COM FRONTEND
  IF v_message_type = 'audio' OR v_content ILIKE '%🎵 Áudio%' THEN
    v_timeout_seconds := 8; -- 8s para áudio (sincronizado)
  ELSIF v_message_type = 'image' OR v_content ILIKE '%📷 Imagem%' THEN
    v_timeout_seconds := 8; -- 8s para imagem (sincronizado)
  ELSIF v_content ~* 'vou.*(enviar|mandar).*(imagem|áudio)|analise.*(imagem|áudio).*que.*vou|mando.*(imagem|áudio)|próxima.*(imagem|áudio)' THEN
    v_timeout_seconds := 10; -- 10s para comandos de mídia futura (sincronizado)
  ELSE
    v_timeout_seconds := 3; -- 3s para texto simples (sincronizado)
  END IF;
  
  -- VERIFICAR SE EXISTE BATCH RECENTE (dentro da janela temporal SINCRONIZADA)
  SELECT id, messages INTO v_batch_id, v_existing_messages
  FROM public.message_batches
  WHERE chat_id = p_chat_id 
    AND client_id = p_client_id
    AND processing_started_at IS NULL
    AND last_updated > (NOW() - INTERVAL '1 second' * v_timeout_seconds) -- Janela temporal sincronizada
  FOR UPDATE SKIP LOCKED;

  IF v_batch_id IS NOT NULL THEN
    -- RESETAR JANELA TEMPORAL: Atualizar batch existente
    v_updated_messages := coalesce(v_existing_messages, '[]'::jsonb) || jsonb_build_array(p_message);
    
    UPDATE public.message_batches 
    SET 
      messages = v_updated_messages,
      last_updated = NOW() -- RESETAR TIMER SINCRONIZADO
    WHERE id = v_batch_id;
    
    v_message_count := jsonb_array_length(v_updated_messages);
    
    RAISE LOG '[BATCH-RPC-V2] ♻️ Batch atualizado (timer resetado): % mensagens, timeout: %s', v_message_count, v_timeout_seconds;
  ELSE
    -- CRIAR NOVO BATCH com timeout sincronizado
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
    
    RAISE LOG '[BATCH-RPC-V2] ✨ Novo batch criado: % (timeout: %s)', v_batch_id, v_timeout_seconds;
  END IF;

  -- Retornar resultado com timeouts sincronizados
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'is_new_batch', v_is_new_batch,
    'message_count', v_message_count,
    'timeout_seconds', v_timeout_seconds,
    'version', 'v2_synchronized'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[BATCH-RPC-V2] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;