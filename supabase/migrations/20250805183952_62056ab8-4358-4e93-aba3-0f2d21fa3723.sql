-- FORÇAR REMOÇÃO DOS JOBS CONFLITANTES POR ID
-- Job 3: process-message-batches-auto (cada minuto)
SELECT cron.unschedule(3);

-- Job 6: process-message-batches (cada minuto - comando malformado)  
SELECT cron.unschedule(6);

-- Verificar jobs restantes (devem sobrar apenas jobs 5 e 7)
-- Job 5: heartbeat-online-status-30s (OK - diferente função)
-- Job 7: process-message-batches-fast (OK - nosso job otimizado de 5s)