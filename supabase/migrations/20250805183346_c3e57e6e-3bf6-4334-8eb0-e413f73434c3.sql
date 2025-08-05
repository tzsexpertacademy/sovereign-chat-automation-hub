-- Função para limpar jobs cron conflitantes
CREATE OR REPLACE FUNCTION public.cleanup_cron_conflicts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Tentar remover job por nome primeiro
  PERFORM cron.unschedule('process-message-batches-auto');
  PERFORM cron.unschedule('process-message-batches');
  
  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Jobs conflitantes removidos',
    'timestamp', now()
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', now()
  );
END;
$$;

-- Executar a limpeza
SELECT public.cleanup_cron_conflicts();