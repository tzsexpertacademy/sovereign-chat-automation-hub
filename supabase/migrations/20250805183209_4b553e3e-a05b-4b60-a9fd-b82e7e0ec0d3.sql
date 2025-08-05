-- Remover jobs conflitantes que estão causando lentidão
-- Desativar job 3 (process-message-batches-auto) - executa a cada 60s
SELECT cron.unschedule('process-message-batches-auto');

-- Desativar job 6 (process-message-batches) - executa a cada 60s  
SELECT cron.unschedule('process-message-batches');

-- Job 7 (process-message-batches-fast) permanece ativo - executa a cada 5s
-- Este é o job otimizado que deve ser o único ativo