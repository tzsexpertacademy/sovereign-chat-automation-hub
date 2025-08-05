-- LIMPEZA FINAL - Remover job duplicado
-- Remover Job 6 (antigo, 1 minuto) e manter Job 8 (novo, 5 segundos)

-- Remover Job 6 por ID específico  
SELECT cron.unschedule(6);

-- Verificação final - deve sobrar apenas 2 jobs
SELECT 
  'CONSOLIDAÇÃO FINAL:' as status,
  COUNT(*) as total_jobs
FROM cron.job 
WHERE active = true;

-- Lista limpa final
SELECT 
  jobid,
  jobname, 
  schedule,
  'ATIVO' as status
FROM cron.job 
WHERE active = true 
ORDER BY jobid;