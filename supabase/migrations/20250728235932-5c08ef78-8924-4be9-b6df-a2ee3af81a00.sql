-- Habilitar configuração de status online para teste
UPDATE client_ai_configs 
SET online_status_config = jsonb_build_object(
  'enabled', true,
  'autoOnline', true,
  'onlinePrivacy', 'all',
  'seenPrivacy', 'all',
  'profileStatus', 'Atendimento automatizado ativo',
  'showActivityIndicator', true
)
WHERE client_id = '35f36a03-39b2-412c-bba6-01fdd45c2dd3';