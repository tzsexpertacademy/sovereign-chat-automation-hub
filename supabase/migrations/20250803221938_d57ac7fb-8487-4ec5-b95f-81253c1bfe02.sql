-- Corrigir advanced_settings e adicionar image_library ao assistente Yumer
UPDATE public.assistants 
SET advanced_settings = (
  CASE 
    WHEN jsonb_typeof(advanced_settings) = 'string' THEN 
      (advanced_settings #>> '{}')::jsonb
    ELSE 
      advanced_settings
  END
) || jsonb_build_object(
  'image_library', 
  jsonb_build_array(
    jsonb_build_object(
      'id', 'image_1754259000000',
      'name', 'Teste Lotetestet',
      'trigger', 'lotetestet',
      'url', '',
      'imageBase64', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    )
  )
)
WHERE name = 'Yumer' AND client_id = '35f36a03-39b2-412c-bba6-01fdd45c2dd3';