
-- Adicionar coluna para configurações avançadas dos assistentes se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'assistants' 
                   AND column_name = 'advanced_settings') THEN
        ALTER TABLE public.assistants
        ADD COLUMN advanced_settings JSONB DEFAULT '{
            "audio_processing_enabled": false,
            "voice_cloning_enabled": false,
            "eleven_labs_voice_id": "",
            "eleven_labs_api_key": "",
            "response_delay_seconds": 3,
            "message_processing_delay_seconds": 10,
            "message_batch_timeout_seconds": 10,
            "typing_indicator_enabled": true,
            "recording_indicator_enabled": true,
            "humanization_level": "advanced",
            "custom_files": []
        }'::jsonb;
        
        -- Índice para performance nas consultas de configurações avançadas
        CREATE INDEX idx_assistants_advanced_settings ON public.assistants USING GIN (advanced_settings);
        
        -- Comentário explicativo
        COMMENT ON COLUMN public.assistants.advanced_settings IS 'Configurações avançadas de humanização: áudio, delays, indicadores visuais, etc.';
    END IF;
END $$;

-- Adicionar campos para controle de estado das conversas no WhatsApp
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'whatsapp_messages' 
                   AND column_name = 'is_read') THEN
        ALTER TABLE public.whatsapp_messages
        ADD COLUMN is_read BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'whatsapp_messages' 
                   AND column_name = 'read_at') THEN
        ALTER TABLE public.whatsapp_messages
        ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'whatsapp_messages' 
                   AND column_name = 'is_processed') THEN
        ALTER TABLE public.whatsapp_messages
        ADD COLUMN is_processed BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'whatsapp_messages' 
                   AND column_name = 'processing_started_at') THEN
        ALTER TABLE public.whatsapp_messages
        ADD COLUMN processing_started_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Adicionar campos para estado de digitação/gravação nos chats
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'whatsapp_chats' 
                   AND column_name = 'is_typing') THEN
        ALTER TABLE public.whatsapp_chats
        ADD COLUMN is_typing BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'whatsapp_chats' 
                   AND column_name = 'is_recording') THEN
        ALTER TABLE public.whatsapp_chats
        ADD COLUMN is_recording BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'whatsapp_chats' 
                   AND column_name = 'typing_started_at') THEN
        ALTER TABLE public.whatsapp_chats
        ADD COLUMN typing_started_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
