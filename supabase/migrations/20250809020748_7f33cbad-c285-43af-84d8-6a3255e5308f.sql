-- Create the missing RPC used by yumer-webhook to create message batches immediately
-- This fixes errors like PGRST202: function public.manage_message_batch_immediate(...) not found

-- 1) Main function with explicit parameters
CREATE OR REPLACE FUNCTION public.manage_message_batch_immediate(
  p_chat_id text,
  p_client_id uuid,
  p_instance_id text,
  p_message jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_batch_id uuid;
  v_message_id text;
  v_content text;
  v_from_me boolean := false;
  v_timestamp_ms bigint;
BEGIN
  -- Extract fields with robust fallbacks
  v_message_id := COALESCE(
    p_message->>'messageId',
    p_message->>'keyId',
    p_message->>'message_id',
    p_message->'key'->>'id'
  );

  v_content := COALESCE(
    p_message->'content'->>'text',
    p_message->>'body',
    p_message->'message'->>'conversation',
    ''
  );

  v_from_me := COALESCE(
    NULLIF(p_message->>'from_me','')::boolean,
    NULLIF(p_message->>'fromMe','')::boolean,
    NULLIF(p_message->'key'->>'fromMe','')::boolean,
    false
  );

  v_timestamp_ms := COALESCE(
    NULLIF(p_message->>'timestamp','')::bigint,
    NULLIF(p_message->>'messageTimestamp','')::bigint,
    (EXTRACT(EPOCH FROM now()))::bigint
  ) * 1000;

  -- Create the batch immediately
  INSERT INTO public.message_batches (
    chat_id,
    client_id,
    instance_id,
    messages,
    created_at
  ) VALUES (
    p_chat_id,
    p_client_id,
    p_instance_id,
    jsonb_build_array(
      jsonb_build_object(
        'messageId', v_message_id,
        'chatId', p_chat_id,
        'content', v_content,
        'fromMe', v_from_me,
        'timestamp', v_timestamp_ms
      )
    ),
    now()
  )
  RETURNING id INTO v_batch_id;

  RETURN v_batch_id;
END;
$$;

-- 2) Convenience overload accepting a single JSONB payload
CREATE OR REPLACE FUNCTION public.manage_message_batch_immediate(
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_chat_id text;
  v_client_id uuid;
  v_instance_id text;
  v_message jsonb;
BEGIN
  v_chat_id := COALESCE(p_payload->>'chat_id', p_payload->>'chatId');
  v_client_id := (p_payload->>'client_id')::uuid;
  v_instance_id := COALESCE(p_payload->>'instance_id', p_payload->>'instanceId');
  v_message := COALESCE(p_payload->'message', p_payload);

  RETURN public.manage_message_batch_immediate(
    v_chat_id,
    v_client_id,
    v_instance_id,
    v_message
  );
END;
$$;