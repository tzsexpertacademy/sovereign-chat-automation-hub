-- Inicializar image_library para assistentes que não têm essa propriedade
UPDATE assistants 
SET advanced_settings = COALESCE(advanced_settings, '{}'::jsonb) || '{"image_library": []}'::jsonb
WHERE advanced_settings IS NULL 
   OR NOT (advanced_settings ? 'image_library');

-- Garantir que audio_library também existe
UPDATE assistants 
SET advanced_settings = advanced_settings || '{"audio_library": []}'::jsonb
WHERE NOT (advanced_settings ? 'audio_library');