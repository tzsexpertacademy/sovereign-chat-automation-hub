-- FORÇAR REMOÇÃO DO JOB 6 POR ID USANDO pg_cron
SELECT cron.unschedule(6);

-- Verificar se foi removido
SELECT 'Jobs ativos após remoção:' as status;
SELECT jobid, jobname, schedule FROM cron.job WHERE active = true ORDER BY jobid;