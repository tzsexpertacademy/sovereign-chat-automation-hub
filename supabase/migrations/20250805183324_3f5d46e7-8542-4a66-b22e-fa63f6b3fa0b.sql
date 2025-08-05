-- Primeiro, vamos ver todos os jobs ativos
SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;

-- Remover apenas os jobs que conseguimos identificar nos logs
-- Job 3 existe e deve ser removido
SELECT cron.unschedule(3);

-- Job 6 aparece nos logs, vamos tentar remover por ID
SELECT cron.unschedule(6);