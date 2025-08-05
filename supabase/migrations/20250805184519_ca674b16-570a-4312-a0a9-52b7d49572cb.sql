-- REMOÇÃO FORÇADA AGRESSIVA DO JOB 6 CONFLITANTE
-- Tentar múltiplas estratégias para garantir remoção

-- Estratégia 1: Remoção por ID direto
SELECT cron.unschedule(6);

-- Estratégia 2: Remoção por nome (backup)  
SELECT cron.unschedule('process-message-batches');

-- Estratégia 3: Atualizar como inativo se ainda existir
UPDATE cron.job 
SET active = false 
WHERE jobid = 6 OR jobname = 'process-message-batches';

-- VERIFICAÇÃO FINAL - apenas jobs ativos devem aparecer
SELECT 
  'Status dos jobs após limpeza forçada:' as resultado,
  COUNT(*) as total_jobs_ativos
FROM cron.job 
WHERE active = true;

-- Listar apenas jobs que sobreviveram
SELECT 
  jobid,
  jobname, 
  schedule,
  'ATIVO' as status
FROM cron.job 
WHERE active = true 
ORDER BY jobid;