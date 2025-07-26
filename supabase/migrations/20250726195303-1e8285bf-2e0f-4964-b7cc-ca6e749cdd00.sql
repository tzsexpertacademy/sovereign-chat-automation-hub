-- Adicionar campos de criptografia à tabela ticket_messages para suportar áudio WhatsApp
ALTER TABLE public.ticket_messages 
ADD COLUMN media_key text,
ADD COLUMN file_enc_sha256 text,
ADD COLUMN file_sha256 text;

-- Criar função para salvar mensagem de ticket com metadados de criptografia
CREATE OR REPLACE FUNCTION public.save_ticket_message(
  p_ticket_id uuid,
  p_message_id text,
  p_content text,
  p_message_type text,
  p_from_me boolean,
  p_timestamp timestamp with time zone,
  p_sender_name text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_duration integer DEFAULT NULL,
  p_media_key text DEFAULT NULL,
  p_file_enc_sha256 text DEFAULT NULL,
  p_file_sha256 text DEFAULT NULL,
  p_audio_base64 text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_message_id uuid;
BEGIN
  -- Inserir mensagem no ticket
  INSERT INTO public.ticket_messages (
    ticket_id,
    message_id,
    content,
    message_type,
    from_me,
    timestamp,
    sender_name,
    media_url,
    media_duration,
    media_key,
    file_enc_sha256,
    file_sha256,
    audio_base64
  )
  VALUES (
    p_ticket_id,
    p_message_id,
    p_content,
    p_message_type,
    p_from_me,
    p_timestamp,
    p_sender_name,
    p_media_url,
    p_media_duration,
    p_media_key,
    p_file_enc_sha256,
    p_file_sha256,
    p_audio_base64
  )
  RETURNING id INTO v_message_id;
  
  RETURN v_message_id;
END;
$function$