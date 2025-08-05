-- Criar função para remover jobs conflitantes por nome
CREATE OR REPLACE FUNCTION public.force_cleanup_cron_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_msg TEXT := '';
BEGIN
  -- Tentar remover jobs conflitantes
  BEGIN
    PERFORM cron.unschedule('process-message-batches-auto');
    result_msg := result_msg || 'Job process-message-batches-auto removido; ';
  EXCEPTION WHEN OTHERS THEN
    result_msg := result_msg || 'Erro ao remover process-message-batches-auto: ' || SQLERRM || '; ';
  END;

  BEGIN
    PERFORM cron.unschedule('process-message-batches');
    result_msg := result_msg || 'Job process-message-batches removido; ';
  EXCEPTION WHEN OTHERS THEN
    result_msg := result_msg || 'Erro ao remover process-message-batches: ' || SQLERRM || '; ';
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', result_msg,
    'timestamp', now()
  );
END;
$$;

-- Executar limpeza
SELECT public.force_cleanup_cron_jobs();