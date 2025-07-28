-- Adicionar coluna para configuração de status online
ALTER TABLE client_ai_configs 
ADD COLUMN online_status_config JSONB DEFAULT '{"enabled": false, "autoOnline": true, "detectionInterval": 30, "offlineTimeout": 5, "enablePresenceDetection": true, "showActivityIndicator": true}'::jsonb;