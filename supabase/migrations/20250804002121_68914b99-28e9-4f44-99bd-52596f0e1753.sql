-- Corrigir assistentes existentes que têm video_library como null
UPDATE assistants 
SET advanced_settings = CASE 
  WHEN advanced_settings->>'video_library' IS NULL THEN
    advanced_settings || '{"video_library": []}'::jsonb
  ELSE
    advanced_settings
END
WHERE advanced_settings IS NOT NULL 
AND advanced_settings->>'video_library' IS NULL;