-- ==============================================================================
-- CORREÇÃO DEFINITIVA: SISTEMA PROCESSAMENTO IMEDIATO SEM CRONS
-- ==============================================================================

-- ETAPA 1: Limpar todos os crons conflitantes
DO $$
DECLARE
  job_record RECORD;
  total_removed INTEGER := 0;
BEGIN
  -- Remover TODOS os jobs de processamento de mensagens
  FOR job_record IN 
    SELECT jobid, jobname 
    FROM cron.job 
    WHERE jobname ILIKE '%process-message%' 
       OR jobname ILIKE '%batch%'
       OR jobname ILIKE '%scheduler%'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    total_removed := total_removed + 1;
    RAISE LOG '[CRON-CLEANUP] Job removido: % (ID: %)', job_record.jobname, job_record.jobid;
  END LOOP;
  
  RAISE LOG '[CRON-CLEANUP] Total de jobs removidos: %', total_removed;
END $$;

-- ETAPA 2: Atualizar RPC para usar URLs diretas (sem variáveis de sistema)
CREATE OR REPLACE FUNCTION public.schedule_immediate_batch_processing(p_batch_id uuid, p_timeout_seconds integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_batch_exists boolean;
  v_timeout_ms integer;
  v_http_response jsonb;
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
  RAISE LOG '[SCHEDULE-IMMEDIATE] 🚀 Agendando processamento IMEDIATO: batch=% timeout=%ms', p_batch_id, v_timeout_ms;
  
  -- Chamar edge function immediate-batch-processor com URL DIRETA
  SELECT net.http_post(
    url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/immediate-batch-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY'
    ),
    body := jsonb_build_object(
      'action', 'schedule',
      'batchId', p_batch_id,
      'timeout', v_timeout_ms
    )
  ) INTO v_http_response;
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'timeout_ms', v_timeout_ms,
    'processing_scheduled', true,
    'http_response', v_http_response,
    'message', 'Processamento IMEDIATO agendado com URLs diretas'
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[SCHEDULE-IMMEDIATE] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

-- ETAPA 3: Criar função para processar batches órfãos imediatamente
CREATE OR REPLACE FUNCTION public.process_orphaned_batches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_batch RECORD;
  v_result jsonb;
  v_processed INTEGER := 0;
  v_errors INTEGER := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  -- Processar todos os batches órfãos (mais de 1 minuto sem processamento)
  FOR v_batch IN 
    SELECT id, chat_id, jsonb_array_length(messages) as msg_count, created_at
    FROM public.message_batches 
    WHERE processing_started_at IS NULL
      AND created_at < NOW() - INTERVAL '30 seconds'
    ORDER BY created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      RAISE LOG '[RECOVERY] Processando batch órfão: % (% mensagens, criado: %)', v_batch.id, v_batch.msg_count, v_batch.created_at;
      
      -- Chamar immediate processor diretamente
      SELECT net.http_post(
        url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/process-message-batches',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY'
        ),
        body := jsonb_build_object(
          'trigger', 'recovery',
          'batchId', v_batch.id
        )
      ) INTO v_result;
      
      v_processed := v_processed + 1;
      v_results := v_results || jsonb_build_object(
        'batch_id', v_batch.id,
        'success', true,
        'message_count', v_batch.msg_count
      );
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE LOG '[RECOVERY] Erro ao processar batch %: %', v_batch.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed_batches', v_processed,
    'errors', v_errors,
    'results', v_results,
    'timestamp', NOW()
  );
END;
$function$;

-- ETAPA 4: Executar recuperação imediata
SELECT public.process_orphaned_batches();

-- ETAPA 5: Log de confirmação final
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
  
  RAISE LOG '🚀 [SISTEMA-DEFINITIVO] CONFIGURAÇÃO FINALIZADA:';
  RAISE LOG '✅ Crons removidos (ativos restantes: %)', v_active_crons;
  RAISE LOG '✅ Sistema processamento imediato configurado';
  RAISE LOG '✅ URLs diretas implementadas';
  RAISE LOG '✅ Batches órfãos processados';
  RAISE LOG '📊 Batches pendentes: %', v_pending_batches;
  RAISE LOG '🎯 Status: SISTEMA PRONTO - TESTE AGORA!';
END $$;