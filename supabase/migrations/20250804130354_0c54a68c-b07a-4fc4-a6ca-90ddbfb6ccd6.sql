-- Limpeza urgente: Remover video_library do advanced_settings para resolver timeout
UPDATE public.assistants 
SET advanced_settings = jsonb_set(
  advanced_settings, 
  '{video_library}', 
  '[]'::jsonb
)
WHERE id = 'fad74a47-c94a-47f9-8e67-26da5083676e';

-- Verificar se existe video_library em outros assistentes e limpar se necessário
UPDATE public.assistants 
SET advanced_settings = jsonb_set(
  advanced_settings, 
  '{video_library}', 
  '[]'::jsonb
)
WHERE advanced_settings ? 'video_library' 
  AND jsonb_array_length(advanced_settings->'video_library') > 0;