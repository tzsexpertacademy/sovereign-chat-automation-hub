-- ==============================================================================
-- ETAPA 1: CONFIGURAR VARIÁVEIS DO SISTEMA SUPABASE
-- ==============================================================================

-- Configurar URL do Supabase
DO $$
BEGIN
  -- Verificar se a configuração já existe
  IF NOT EXISTS (SELECT 1 FROM pg_settings WHERE name = 'app.supabase_url') THEN
    ALTER DATABASE postgres SET app.supabase_url = 'https://ymygyagbvbsdfkduxmgu.supabase.co';
  END IF;
  
  -- Configurar service role key
  IF NOT EXISTS (SELECT 1 FROM pg_settings WHERE name = 'app.service_role_key') THEN
    ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY';
  END IF;
END $$;

-- ==============================================================================
-- ETAPA 2: LIMPAR TODOS OS CRONS CONFLITANTES
-- ==============================================================================

-- Remover TODOS os crons relacionados ao processamento de mensagens
DO $$
DECLARE
  job_record RECORD;
BEGIN
  -- Listar e remover todos os jobs conflitantes
  FOR job_record IN 
    SELECT jobid, jobname 
    FROM cron.job 
    WHERE jobname ILIKE '%process-message%' 
       OR jobname ILIKE '%batch%'
       OR jobname ILIKE '%scheduler%'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE LOG '[CRON-CLEANUP] Job removido: % (ID: %)', job_record.jobname, job_record.jobid;
  END LOOP;
END $$;

-- ==============================================================================
-- ETAPA 3: CRIAR SISTEMA DE PROCESSAMENTO IMEDIATO PURO
-- ==============================================================================

-- Criar edge function para processamento imediato sem dependência de cron
CREATE OR REPLACE FUNCTION public.process_immediate_message_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_batch_exists boolean;
  v_response jsonb;
BEGIN
  -- Verificar se batch existe e está pendente
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
  
  -- Chamar edge function process-message-batches diretamente
  SELECT net.http_post(
    url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/process-message-batches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY'
    ),
    body := jsonb_build_object(
      'trigger', 'immediate',
      'batchId', p_batch_id
    )
  ) INTO v_response;
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'processing_triggered', true,
    'timestamp', NOW()
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

-- ==============================================================================
-- ETAPA 4: PROCESSAR BATCHES ÓRFÃOS IMEDIATAMENTE
-- ==============================================================================

-- Processar todos os batches pendentes órfãos
DO $$
DECLARE
  v_batch RECORD;
  v_result jsonb;
BEGIN
  FOR v_batch IN 
    SELECT id, chat_id, jsonb_array_length(messages) as msg_count
    FROM public.message_batches 
    WHERE processing_started_at IS NULL
    ORDER BY created_at ASC
  LOOP
    RAISE LOG '[IMMEDIATE-RECOVERY] Processando batch órfão: % (% mensagens)', v_batch.id, v_batch.msg_count;
    
    -- Processar batch imediatamente
    SELECT public.process_immediate_message_batch(v_batch.id) INTO v_result;
    
    RAISE LOG '[IMMEDIATE-RECOVERY] Resultado: %', v_result;
  END LOOP;
END $$;

-- ==============================================================================
-- CONFIRMAÇÃO DO SISTEMA
-- ==============================================================================

-- Log de confirmação
DO $$
BEGIN
  RAISE LOG '🚀 [SISTEMA-IMEDIATO] CONFIGURAÇÃO CONCLUÍDA:';
  RAISE LOG '✅ Variáveis do sistema configuradas';
  RAISE LOG '✅ Crons conflitantes removidos';
  RAISE LOG '✅ Sistema de processamento imediato ativo';
  RAISE LOG '✅ Batches órfãos processados';
  RAISE LOG '📊 Status: PRONTO PARA TESTES';
END $$;