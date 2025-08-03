-- Adicionar image_library ao assistente Yumer
UPDATE public.assistants 
SET advanced_settings = jsonb_set(
  COALESCE(advanced_settings, '{}'::jsonb),
  '{image_library}',
  '[{
    "id": "image_1754259000000",
    "name": "Teste Lotetestet",
    "trigger": "lotetestet",
    "url": "",
    "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  }]'::jsonb
)
WHERE name = 'Yumer' AND client_id = '35f36a03-39b2-412c-bba6-01fdd45c2dd3';