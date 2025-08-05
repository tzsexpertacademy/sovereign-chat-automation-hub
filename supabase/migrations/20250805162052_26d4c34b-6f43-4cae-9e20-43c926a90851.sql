-- CORREÇÃO IMEDIATA: Marcar mensagens problemáticas como concluídas para parar o loop infinito
-- Identificadas pelos URLs únicos que estão causando stack overflow

UPDATE public.ticket_messages 
SET processing_status = 'completed'
WHERE media_url LIKE '%14754183_600734546444784_520505985521823499_n.enc%'
   OR media_url LIKE '%518450575_1191262379699683_725568326784264913_n.enc%'  
   OR media_url LIKE '%23831523_1801767090736092_2190950784109265716_n.enc%';

-- Log para confirmar quantas mensagens foram atualizadas
-- SELECT COUNT(*) FROM public.ticket_messages 
-- WHERE processing_status = 'completed' 
-- AND (media_url LIKE '%14754183_600734546444784_520505985521823499_n.enc%'
--      OR media_url LIKE '%518450575_1191262379699683_725568326784264913_n.enc%'  
--      OR media_url LIKE '%23831523_1801767090736092_2190950784109265716_n.enc%');