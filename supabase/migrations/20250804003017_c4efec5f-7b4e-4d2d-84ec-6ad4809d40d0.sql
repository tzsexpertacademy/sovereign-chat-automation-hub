-- PASSO 1: Corrigir estrutura malformada no banco de dados
-- Identificar e corrigir assistentes que têm advanced_settings como array em vez de objeto

-- Primeiro, backup dos dados atuais em uma tabela temporária para segurança
CREATE TEMP TABLE assistant_backup AS 
SELECT id, name, advanced_settings FROM assistants;

-- Corrigir assistentes que têm advanced_settings malformado (como array)
UPDATE assistants 
SET advanced_settings = CASE 
  -- Se é um array com string JSON, extrair e converter para objeto
  WHEN jsonb_typeof(advanced_settings) = 'array' AND jsonb_array_length(advanced_settings) > 0 THEN
    (advanced_settings->0)::jsonb
  -- Se é null, criar estrutura padrão
  WHEN advanced_settings IS NULL THEN
    '{"audio_library": [], "image_library": [], "video_library": [], "ai_settings": {"temperature": 0.7, "max_tokens": 1000, "humanization_level": 1}, "multimedia_analysis": {"enabled": false, "vision_model": "gpt-4-vision-preview"}, "voice_settings": {"provider": "elevenlabs", "voice_id": null, "model": "eleven_multilingual_v2", "stability": 0.5, "similarity_boost": 0.5}, "recording_settings": {"auto_recording": false, "max_duration": 60}, "behavior_settings": {"response_delay": 0}}'::jsonb
  -- Se já é objeto mas falta alguma biblioteca, garantir que existe
  WHEN jsonb_typeof(advanced_settings) = 'object' THEN
    advanced_settings 
    || CASE WHEN advanced_settings->>'audio_library' IS NULL THEN '{"audio_library": []}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN advanced_settings->>'image_library' IS NULL THEN '{"image_library": []}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN advanced_settings->>'video_library' IS NULL THEN '{"video_library": []}'::jsonb ELSE '{}'::jsonb END
  ELSE advanced_settings
END
WHERE advanced_settings IS NULL 
   OR jsonb_typeof(advanced_settings) = 'array'
   OR (jsonb_typeof(advanced_settings) = 'object' AND (
     advanced_settings->>'audio_library' IS NULL OR
     advanced_settings->>'image_library' IS NULL OR 
     advanced_settings->>'video_library' IS NULL
   ));

-- Log das correções feitas
SELECT 
  COUNT(*) as assistants_fixed,
  'Estrutura do banco corrigida - advanced_settings agora são objetos válidos' as status
FROM assistants 
WHERE jsonb_typeof(advanced_settings) = 'object';