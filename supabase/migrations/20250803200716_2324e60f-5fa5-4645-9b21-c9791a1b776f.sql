-- Inicializar image_library para todos os assistentes que não têm
UPDATE assistants 
SET advanced_settings = jsonb_set(
  COALESCE(advanced_settings, '{}'::jsonb),
  '{image_library}',
  '[]'::jsonb,
  true
)
WHERE advanced_settings IS NULL 
   OR NOT (advanced_settings ? 'image_library');