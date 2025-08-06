-- CORREÇÃO DEFINITIVA: LIMPEZA COMPLETA DE CRON JOBS CONFLITANTES
-- FASE 1: Remover TODOS os jobs de processamento de mensagens, manter apenas os necessários

DO $$
DECLARE
    job_record RECORD;
    removed_count INTEGER := 0;
BEGIN
    RAISE LOG '🧹 [CORREÇÃO-DEFINITIVA] Iniciando limpeza completa de cron jobs...';
    
    -- Listar e remover jobs relacionados a processamento de mensagens
    FOR job_record IN 
        SELECT jobname 
        FROM cron.job 
        WHERE jobname IN (
            'process-batches-1min-fixed',
            'process-message-batches', 
            'process-message-batches-auto',
            'process-message-batches-backup'
        )
        AND active = true
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_record.jobname);
            removed_count := removed_count + 1;
            RAISE LOG '✅ [CORREÇÃO-DEFINITIVA] Job removido: %', job_record.jobname;
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG '❌ [CORREÇÃO-DEFINITIVA] Erro ao remover job %: %', job_record.jobname, SQLERRM;
        END;
    END LOOP;
    
    RAISE LOG '🎯 [CORREÇÃO-DEFINITIVA] Total de jobs removidos: %', removed_count;
END $$;

-- FASE 2: Configurar variáveis do sistema para immediate processing
-- Configurar URLs e chaves para as RPC functions funcionarem
DO $$
BEGIN
    BEGIN
        -- Tentar configurar variáveis do sistema
        PERFORM set_config('app.supabase_url', 'https://ymygyagbvbsdfkduxmgu.supabase.co', false);
        PERFORM set_config('app.service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY', false);
        
        RAISE LOG '⚙️ [CORREÇÃO-DEFINITIVA] Variáveis do sistema configuradas';
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG '⚠️ [CORREÇÃO-DEFINITIVA] Erro ao configurar variáveis: %', SQLERRM;
    END;
END $$;

-- FASE 3: Criar APENAS UM job backup estratégico (backup de emergência)
SELECT cron.schedule(
  'emergency-backup-only',
  '*/10 * * * *', -- A cada 10 minutos (muito menos frequente)
  $$
  SELECT net.http_post(
    url := 'https://ymygyagbvbsdfkduxmgu.supabase.co/functions/v1/scheduler-trigger',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.q-Gw6JwMv2dLnWI5JZzE0dNT8WqC-rT_jQ3cO-X5ZqY"}'::jsonb,
    body := '{"trigger": "emergency_backup", "mode": "orphaned_only"}'::jsonb
  );
  $$
);

-- FASE 4: Corrigir RPC function para usar URLs diretas (sem variáveis)
CREATE OR REPLACE FUNCTION public.schedule_immediate_batch_processing(p_batch_id uuid, p_timeout_seconds integer DEFAULT 3)
 RETURNS jsonb
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
  RAISE LOG '[SCHEDULE-BATCH-FIXED] 🚀 Agendando processamento IMEDIATO: batch=% timeout=%ms', p_batch_id, v_timeout_ms;
  
  -- Chamar edge function com URL DIRETA (sem variáveis do sistema)
  PERFORM net.http_post(
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
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'timeout_ms', v_timeout_ms,
    'message', 'Processamento IMEDIATO agendado (URLs diretas)'
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG '[SCHEDULE-BATCH-FIXED] ❌ Erro: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

-- Log final
DO $$
BEGIN
    RAISE LOG '🎯 [CORREÇÃO-DEFINITIVA] ✅ CONCLUÍDA! Sistema configurado para processamento IMEDIATO';
    RAISE LOG '📋 [CORREÇÃO-DEFINITIVA] - Cron jobs conflitantes removidos';
    RAISE LOG '📋 [CORREÇÃO-DEFINITIVA] - Apenas backup de emergência (10min) mantido';
    RAISE LOG '📋 [CORREÇÃO-DEFINITIVA] - RPC functions corrigidas com URLs diretas';
    RAISE LOG '📋 [CORREÇÃO-DEFINITIVA] - Timeout inteligente: 3s texto, 8s mídia, 10s comandos';
END $$;