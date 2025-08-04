-- PASSO 1.2: Correção específica para strings JSON malformadas
-- Converter strings JSON para objetos JSONB válidos

UPDATE assistants 
SET advanced_settings = CASE 
  -- Se é uma string JSON válida, converter para JSONB
  WHEN jsonb_typeof(advanced_settings) = 'string' THEN
    (advanced_settings#>>'{}')::jsonb
  -- Se é uma string que não é JSON válido, criar estrutura padrão
  WHEN advanced_settings IS NULL OR advanced_settings::text = 'null' THEN
    '{"audio_library": [], "image_library": [], "video_library": [], "ai_settings": {"temperature": 0.7, "max_tokens": 1000, "humanization_level": 1}, "multimedia_analysis": {"enabled": false, "vision_model": "gpt-4-vision-preview"}, "voice_settings": {"provider": "elevenlabs", "voice_id": null, "model": "eleven_multilingual_v2", "stability": 0.5, "similarity_boost": 0.5}, "recording_settings": {"auto_recording": false, "max_duration": 60}, "behavior_settings": {"response_delay": 0}}'::jsonb
  ELSE advanced_settings
END
WHERE jsonb_typeof(advanced_settings) = 'string' 
   OR advanced_settings IS NULL;

-- Verificar resultado da correção
SELECT 
  id,
  name,
  jsonb_typeof(advanced_settings) as tipo_final,
  CASE 
    WHEN jsonb_typeof(advanced_settings) = 'object' THEN '✅ CORRIGIDO'
    ELSE '❌ AINDA COM PROBLEMA'
  END as status
FROM assistants;