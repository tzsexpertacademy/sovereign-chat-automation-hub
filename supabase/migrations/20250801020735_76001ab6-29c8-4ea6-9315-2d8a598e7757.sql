-- Executar fix-media-keys para corrigir dados antigos
-- Esta função irá converter campos media_key e file_enc_sha256 malformados em Base64

-- Primeiro, vamos criar uma função para executar o fix-media-keys via SQL
CREATE OR REPLACE FUNCTION public.fix_malformed_media_keys()
RETURNS TABLE(
  fixed_count integer,
  total_checked integer,
  error_messages text[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_total_checked INTEGER := 0;
  v_errors TEXT[] := '{}';
  v_record RECORD;
  v_new_media_key TEXT;
  v_new_file_enc_sha256 TEXT;
BEGIN
  -- Contar registros a serem verificados
  SELECT COUNT(*) INTO v_total_checked
  FROM public.ticket_messages 
  WHERE message_type IN ('image', 'video', 'audio', 'document')
    AND (media_key IS NOT NULL OR file_enc_sha256 IS NOT NULL);

  -- Processar ticket_messages
  FOR v_record IN 
    SELECT id, media_key, file_enc_sha256
    FROM public.ticket_messages 
    WHERE message_type IN ('image', 'video', 'audio', 'document')
      AND (media_key IS NOT NULL OR file_enc_sha256 IS NOT NULL)
  LOOP
    BEGIN
      v_new_media_key := v_record.media_key;
      v_new_file_enc_sha256 := v_record.file_enc_sha256;
      
      -- Verificar se media_key precisa ser corrigido (se contém { ou [)
      IF v_record.media_key IS NOT NULL AND (
        v_record.media_key LIKE '{%' OR 
        v_record.media_key LIKE '[%' OR
        v_record.media_key LIKE '%}%' OR
        v_record.media_key LIKE '%]%'
      ) THEN
        -- Tentar extrair Base64 válido ou marcar como null
        v_new_media_key := NULL;
        v_fixed_count := v_fixed_count + 1;
      END IF;
      
      -- Verificar se file_enc_sha256 precisa ser corrigido
      IF v_record.file_enc_sha256 IS NOT NULL AND (
        v_record.file_enc_sha256 LIKE '{%' OR 
        v_record.file_enc_sha256 LIKE '[%' OR
        v_record.file_enc_sha256 LIKE '%}%' OR
        v_record.file_enc_sha256 LIKE '%]%'
      ) THEN
        -- Tentar extrair Base64 válido ou marcar como null
        v_new_file_enc_sha256 := NULL;
        v_fixed_count := v_fixed_count + 1;
      END IF;
      
      -- Atualizar se houve mudanças
      IF v_new_media_key != v_record.media_key OR v_new_file_enc_sha256 != v_record.file_enc_sha256 THEN
        UPDATE public.ticket_messages 
        SET 
          media_key = v_new_media_key,
          file_enc_sha256 = v_new_file_enc_sha256
        WHERE id = v_record.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Error processing record ' || v_record.id || ': ' || SQLERRM);
    END;
  END LOOP;
  
  -- Processar whatsapp_messages também
  FOR v_record IN 
    SELECT id, media_key, file_enc_sha256
    FROM public.whatsapp_messages 
    WHERE message_type IN ('image', 'video', 'audio', 'document')
      AND (media_key IS NOT NULL OR file_enc_sha256 IS NOT NULL)
  LOOP
    BEGIN
      v_new_media_key := v_record.media_key;
      v_new_file_enc_sha256 := v_record.file_enc_sha256;
      
      -- Mesma lógica para whatsapp_messages
      IF v_record.media_key IS NOT NULL AND (
        v_record.media_key LIKE '{%' OR 
        v_record.media_key LIKE '[%' OR
        v_record.media_key LIKE '%}%' OR
        v_record.media_key LIKE '%]%'
      ) THEN
        v_new_media_key := NULL;
        v_fixed_count := v_fixed_count + 1;
      END IF;
      
      IF v_record.file_enc_sha256 IS NOT NULL AND (
        v_record.file_enc_sha256 LIKE '{%' OR 
        v_record.file_enc_sha256 LIKE '[%' OR
        v_record.file_enc_sha256 LIKE '%}%' OR
        v_record.file_enc_sha256 LIKE '%]%'
      ) THEN
        v_new_file_enc_sha256 := NULL;
        v_fixed_count := v_fixed_count + 1;
      END IF;
      
      IF v_new_media_key != v_record.media_key OR v_new_file_enc_sha256 != v_record.file_enc_sha256 THEN
        UPDATE public.whatsapp_messages 
        SET 
          media_key = v_new_media_key,
          file_enc_sha256 = v_new_file_enc_sha256
        WHERE id = v_record.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 'Error processing whatsapp record ' || v_record.id || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN QUERY SELECT v_fixed_count, v_total_checked, v_errors;
END;
$$;