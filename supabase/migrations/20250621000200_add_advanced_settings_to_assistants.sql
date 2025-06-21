
-- Adicionar coluna para configurações avançadas dos assistentes
ALTER TABLE public.assistants 
ADD COLUMN IF NOT EXISTS advanced_settings JSONB DEFAULT '{}'::jsonb;

-- Índice para pesquisas nas configurações avançadas
CREATE INDEX IF NOT EXISTS idx_assistants_advanced_settings ON public.assistants USING gin(advanced_settings);

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.assistants.advanced_settings IS 'Configurações avançadas do assistente incluindo temperatura, max_tokens, configurações de áudio, etc.';
