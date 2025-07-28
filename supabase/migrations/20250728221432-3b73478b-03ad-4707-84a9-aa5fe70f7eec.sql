-- Melhorar a função upsert_conversation_ticket com atribuição automática de fila
-- e transferência automática entre instâncias

CREATE OR REPLACE FUNCTION public.upsert_conversation_ticket(
  p_client_id uuid, 
  p_chat_id text, 
  p_instance_id text, 
  p_customer_name text, 
  p_customer_phone text, 
  p_last_message text, 
  p_last_message_at timestamp with time zone
) 
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer_id UUID;
  v_ticket_id UUID;
  v_existing_ticket_id UUID;
  v_existing_instance_id TEXT;
  v_title TEXT;
  v_queue_id UUID;
  v_old_queue_id UUID;
  v_normalized_chat_id TEXT;
BEGIN
  -- Normalizar chat_id para busca (remover sufixos diferentes)
  v_normalized_chat_id := REGEXP_REPLACE(p_chat_id, '@(s\.whatsapp\.net|s\.whats|c\.us)$', '');
  
  -- Encontrar ou criar cliente
  SELECT id INTO v_customer_id 
  FROM public.customers 
  WHERE client_id = p_client_id AND phone = p_customer_phone;
  
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (client_id, name, phone, whatsapp_chat_id)
    VALUES (p_client_id, p_customer_name, p_customer_phone, p_chat_id)
    RETURNING id INTO v_customer_id;
    
    RAISE LOG '🎯 [UPSERT-TICKET] Cliente criado: % (telefone: %)', v_customer_id, p_customer_phone;
  END IF;
  
  -- Verificar se existe ticket para o mesmo chat_id normalizado (qualquer instância)
  SELECT ct.id, ct.instance_id, ct.assigned_queue_id 
  INTO v_existing_ticket_id, v_existing_instance_id, v_old_queue_id
  FROM public.conversation_tickets ct
  WHERE ct.client_id = p_client_id 
    AND ct.customer_id = v_customer_id
    AND REGEXP_REPLACE(ct.chat_id, '@(s\.whatsapp\.net|s\.whats|c\.us)$', '') = v_normalized_chat_id
  ORDER BY ct.created_at DESC
  LIMIT 1;
  
  -- Criar título do ticket
  v_title := 'Conversa com ' || p_customer_name;
  
  IF v_existing_ticket_id IS NOT NULL THEN
    -- Ticket existe - verificar se é mudança de instância
    IF v_existing_instance_id != p_instance_id THEN
      RAISE LOG '🔄 [UPSERT-TICKET] Transferência automática detectada: % -> %', v_existing_instance_id, p_instance_id;
      
      -- Buscar nova fila para a nova instância
      SELECT public.auto_assign_queue(p_client_id, p_instance_id, p_last_message) INTO v_queue_id;
      
      IF v_queue_id IS NOT NULL THEN
        -- Registrar transferência automática
        INSERT INTO public.queue_transfers (
          ticket_id, 
          from_queue_id, 
          to_queue_id, 
          transfer_reason, 
          transfer_type,
          initiated_by
        )
        VALUES (
          v_existing_ticket_id, 
          v_old_queue_id, 
          v_queue_id, 
          'Transferência automática por mudança de instância: ' || v_existing_instance_id || ' -> ' || p_instance_id,
          'automatic',
          'system'
        );
        
        RAISE LOG '📋 [UPSERT-TICKET] Transferência registrada: fila % -> %', v_old_queue_id, v_queue_id;
      END IF;
      
      -- Atualizar ticket existente com nova instância e fila
      UPDATE public.conversation_tickets 
      SET 
        instance_id = p_instance_id,
        chat_id = p_chat_id,
        assigned_queue_id = COALESCE(v_queue_id, assigned_queue_id),
        last_message_preview = p_last_message,
        last_message_at = p_last_message_at,
        updated_at = now()
      WHERE id = v_existing_ticket_id;
      
      v_ticket_id := v_existing_ticket_id;
      
      RAISE LOG '✅ [UPSERT-TICKET] Ticket transferido: % (nova instância: %, nova fila: %)', 
        v_ticket_id, p_instance_id, v_queue_id;
    ELSE
      -- Mesma instância - apenas atualizar
      UPDATE public.conversation_tickets 
      SET 
        last_message_preview = p_last_message,
        last_message_at = p_last_message_at,
        updated_at = now()
      WHERE id = v_existing_ticket_id;
      
      v_ticket_id := v_existing_ticket_id;
      
      RAISE LOG '📝 [UPSERT-TICKET] Ticket atualizado: %', v_ticket_id;
    END IF;
  ELSE
    -- Ticket não existe - criar novo
    RAISE LOG '🆕 [UPSERT-TICKET] Criando novo ticket para chat: % (instância: %)', p_chat_id, p_instance_id;
    
    -- Buscar fila automática para nova conversa
    SELECT public.auto_assign_queue(p_client_id, p_instance_id, p_last_message) INTO v_queue_id;
    
    IF v_queue_id IS NOT NULL THEN
      RAISE LOG '🎯 [UPSERT-TICKET] Fila automática encontrada: %', v_queue_id;
    ELSE
      RAISE LOG '⚠️ [UPSERT-TICKET] Nenhuma fila automática encontrada para instância: %', p_instance_id;
    END IF;
    
    -- Criar novo ticket
    INSERT INTO public.conversation_tickets (
      client_id, 
      customer_id, 
      chat_id, 
      instance_id, 
      title, 
      last_message_preview, 
      last_message_at,
      assigned_queue_id
    )
    VALUES (
      p_client_id, 
      v_customer_id, 
      p_chat_id, 
      p_instance_id, 
      v_title,
      p_last_message, 
      p_last_message_at,
      v_queue_id
    )
    RETURNING id INTO v_ticket_id;
    
    RAISE LOG '✅ [UPSERT-TICKET] Novo ticket criado: % (fila: %)', v_ticket_id, v_queue_id;
  END IF;
  
  RETURN v_ticket_id;
END;
$function$