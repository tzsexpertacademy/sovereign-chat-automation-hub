-- Corrigir função upsert_conversation_ticket para fazer lookup correto do business_id → client_id
CREATE OR REPLACE FUNCTION public.upsert_conversation_ticket(p_client_id uuid, p_chat_id text, p_instance_id text, p_customer_name text, p_customer_phone text, p_last_message text, p_last_message_at timestamp with time zone)
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
  v_existing_status TEXT;
  v_title TEXT;
  v_queue_id UUID;
  v_assistant_id UUID;
  v_old_queue_id UUID;
  v_normalized_chat_id TEXT;
  v_final_assistant_id UUID;
  v_actual_client_id UUID; -- NOVA VARIÁVEL PARA CLIENT_ID CORRETO
BEGIN
  -- NOVA LÓGICA: Verificar se p_client_id é um business_id que precisa ser convertido
  -- Primeiro tentar encontrar client_id pelo business_id na tabela codechat_businesses
  SELECT client_id INTO v_actual_client_id
  FROM public.codechat_businesses
  WHERE business_id = p_client_id::text
  AND client_id IS NOT NULL;
  
  -- Se não encontrou na tabela de businesses, assumir que p_client_id já é o client_id correto
  IF v_actual_client_id IS NULL THEN
    v_actual_client_id := p_client_id;
    RAISE LOG '🔧 [UPSERT-TICKET] Usando p_client_id diretamente: %', p_client_id;
  ELSE
    RAISE LOG '🔄 [UPSERT-TICKET] LOOKUP BUSINESS: business_id % → client_id %', p_client_id, v_actual_client_id;
  END IF;
  
  -- Normalizar chat_id para busca (remover sufixos diferentes)
  v_normalized_chat_id := REGEXP_REPLACE(p_chat_id, '@(s\.whatsapp\.net|s\.whats|c\.us)$', '');
  
  -- Encontrar ou criar cliente USANDO O CLIENT_ID CORRETO
  SELECT id INTO v_customer_id 
  FROM public.customers 
  WHERE client_id = v_actual_client_id AND phone = p_customer_phone;
  
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (client_id, name, phone, whatsapp_chat_id)
    VALUES (v_actual_client_id, p_customer_name, p_customer_phone, p_chat_id)
    RETURNING id INTO v_customer_id;
    
    RAISE LOG '🎯 [UPSERT-TICKET] Cliente criado: % (telefone: %, client_id: %)', v_customer_id, p_customer_phone, v_actual_client_id;
  END IF;
  
  -- Verificar se existe ticket para o mesmo chat_id normalizado (qualquer instância) USANDO CLIENT_ID CORRETO
  SELECT ct.id, ct.instance_id, ct.assigned_queue_id, ct.status 
  INTO v_existing_ticket_id, v_existing_instance_id, v_old_queue_id, v_existing_status
  FROM public.conversation_tickets ct
  WHERE ct.client_id = v_actual_client_id 
    AND ct.customer_id = v_customer_id
    AND REGEXP_REPLACE(ct.chat_id, '@(s\.whatsapp\.net|s\.whats|c\.us)$', '') = v_normalized_chat_id
  ORDER BY ct.created_at DESC
  LIMIT 1;
  
  -- Criar título do ticket
  v_title := 'Conversa com ' || p_customer_name;
  
  IF v_existing_ticket_id IS NOT NULL THEN
    -- Ticket existe - verificar se precisa reabrir ou transferir
    
    -- REABERTURA AUTOMÁTICA: Se ticket está fechado/resolvido, reabrir
    IF v_existing_status IN ('closed', 'resolved') THEN
      RAISE LOG '🔓 [UPSERT-TICKET] REABERTURA AUTOMÁTICA detectada para ticket: %', v_existing_ticket_id;
      
      -- Buscar fila padrão para reabertura USANDO CLIENT_ID CORRETO
      SELECT public.auto_assign_queue(v_actual_client_id, p_instance_id, p_last_message, NULL) INTO v_queue_id;
      
      -- Buscar assistente da fila se a fila foi encontrada
      IF v_queue_id IS NOT NULL THEN
        SELECT assistant_id INTO v_assistant_id
        FROM public.queues 
        WHERE id = v_queue_id AND is_active = true;
        
        RAISE LOG '🔓 [UPSERT-TICKET] Fila para reabertura: % (assistente: %, client_id: %)', v_queue_id, v_assistant_id, v_actual_client_id;
      ELSE
        RAISE LOG '⚠️ [UPSERT-TICKET] REABERTURA: Nenhuma fila automática encontrada para client_id: %', v_actual_client_id;
      END IF;
      
      -- Registrar evento de reabertura automática
      INSERT INTO public.ticket_events (
        ticket_id, 
        event_type, 
        description, 
        metadata
      )
      VALUES (
        v_existing_ticket_id, 
        'auto_reopened', 
        'Ticket reaberto automaticamente por nova mensagem', 
        jsonb_build_object(
          'instance_id', p_instance_id,
          'previous_status', v_existing_status,
          'new_queue_id', v_queue_id,
          'new_assistant_id', v_assistant_id,
          'reopen_time', NOW(),
          'client_id_used', v_actual_client_id
        )
      );
      
      -- Atualizar ticket com reabertura
      UPDATE public.conversation_tickets 
      SET 
        status = 'open',
        closed_at = NULL,
        instance_id = p_instance_id,
        chat_id = p_chat_id,
        assigned_queue_id = COALESCE(v_queue_id, assigned_queue_id),
        assigned_assistant_id = COALESCE(v_assistant_id, assigned_assistant_id),
        last_message_preview = p_last_message,
        last_message_at = p_last_message_at,
        updated_at = now()
      WHERE id = v_existing_ticket_id;
      
      v_ticket_id := v_existing_ticket_id;
      
      RAISE LOG '✅ [UPSERT-TICKET] Ticket REABERTO automaticamente: % (nova fila: %, assistente: %, client_id: %)', 
        v_ticket_id, v_queue_id, v_assistant_id, v_actual_client_id;
        
    -- TRANSFERÊNCIA DE INSTÂNCIA: Ticket aberto mas mudou de instância
    ELSIF v_existing_instance_id != p_instance_id THEN
      RAISE LOG '🔄 [UPSERT-TICKET] Transferência automática detectada: % -> %', v_existing_instance_id, p_instance_id;
      
      -- Buscar nova fila para a nova instância USANDO CLIENT_ID CORRETO
      SELECT public.auto_assign_queue(v_actual_client_id, p_instance_id, p_last_message, v_old_queue_id) INTO v_queue_id;
      
      -- Buscar assistente da fila se a fila foi encontrada
      IF v_queue_id IS NOT NULL THEN
        SELECT assistant_id INTO v_assistant_id
        FROM public.queues 
        WHERE id = v_queue_id AND is_active = true;
        
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
        
        RAISE LOG '📋 [UPSERT-TICKET] Transferência registrada: fila % -> % (assistente: %, client_id: %)', v_old_queue_id, v_queue_id, v_assistant_id, v_actual_client_id;
      ELSE
        RAISE LOG '⚠️ [UPSERT-TICKET] TRANSFERÊNCIA: Nenhuma fila automática encontrada para client_id: %', v_actual_client_id;
      END IF;
      
      -- Atualizar ticket existente com nova instância, fila e assistente
      UPDATE public.conversation_tickets 
      SET 
        instance_id = p_instance_id,
        chat_id = p_chat_id,
        assigned_queue_id = COALESCE(v_queue_id, assigned_queue_id),
        assigned_assistant_id = COALESCE(v_assistant_id, assigned_assistant_id),
        last_message_preview = p_last_message,
        last_message_at = p_last_message_at,
        updated_at = now()
      WHERE id = v_existing_ticket_id;
      
      v_ticket_id := v_existing_ticket_id;
      
      RAISE LOG '✅ [UPSERT-TICKET] Ticket transferido: % (nova instância: %, nova fila: %, assistente: %, client_id: %)', 
        v_ticket_id, p_instance_id, v_queue_id, v_assistant_id, v_actual_client_id;
        
    ELSE
      -- ATUALIZAÇÃO SIMPLES: Mesma instância, ticket já aberto
      -- Verificar se assistente está faltando
      SELECT ct.assigned_queue_id, ct.assigned_assistant_id 
      INTO v_queue_id, v_assistant_id
      FROM public.conversation_tickets ct
      WHERE ct.id = v_existing_ticket_id;
      
      -- CORREÇÃO AUTOMÁTICA: Se tem fila mas não tem assistente, corrigir
      IF v_queue_id IS NOT NULL AND v_assistant_id IS NULL THEN
        SELECT assistant_id INTO v_assistant_id
        FROM public.queues 
        WHERE id = v_queue_id AND is_active = true;
        
        RAISE LOG '🔧 [UPSERT-TICKET] CORREÇÃO AUTOMÁTICA: Corrigindo assistente faltante: fila % -> assistente % (client_id: %)', v_queue_id, v_assistant_id, v_actual_client_id;
      END IF;
      
      -- Atualizar timestamps e assistente se necessário
      UPDATE public.conversation_tickets 
      SET 
        assigned_assistant_id = COALESCE(v_assistant_id, assigned_assistant_id),
        last_message_preview = p_last_message,
        last_message_at = p_last_message_at,
        updated_at = now()
      WHERE id = v_existing_ticket_id;
      
      v_ticket_id := v_existing_ticket_id;
      
      RAISE LOG '📝 [UPSERT-TICKET] Ticket atualizado: % (assistente: %, client_id: %)', v_ticket_id, v_assistant_id, v_actual_client_id;
    END IF;
  ELSE
    -- Ticket não existe - criar novo
    RAISE LOG '🆕 [UPSERT-TICKET] Criando novo ticket para chat: % (instância: %, client_id: %)', p_chat_id, p_instance_id, v_actual_client_id;
    
    -- Buscar fila automática para nova conversa USANDO CLIENT_ID CORRETO
    SELECT public.auto_assign_queue(v_actual_client_id, p_instance_id, p_last_message, NULL) INTO v_queue_id;
    
    -- Buscar assistente da fila se a fila foi encontrada
    IF v_queue_id IS NOT NULL THEN
      SELECT assistant_id INTO v_assistant_id
      FROM public.queues 
      WHERE id = v_queue_id AND is_active = true;
      
      RAISE LOG '🎯 [UPSERT-TICKET] Fila automática encontrada: % (assistente: %, client_id: %)', v_queue_id, v_assistant_id, v_actual_client_id;
    ELSE
      RAISE LOG '⚠️ [UPSERT-TICKET] CRIAÇÃO: Nenhuma fila automática encontrada para instância: % (client_id: %)', p_instance_id, v_actual_client_id;
    END IF;
    
    -- Criar novo ticket com fila e assistente USANDO CLIENT_ID CORRETO
    INSERT INTO public.conversation_tickets (
      client_id, 
      customer_id, 
      chat_id, 
      instance_id, 
      title, 
      last_message_preview, 
      last_message_at,
      assigned_queue_id,
      assigned_assistant_id,
      status
    )
    VALUES (
      v_actual_client_id, 
      v_customer_id, 
      p_chat_id, 
      p_instance_id, 
      v_title,
      p_last_message, 
      p_last_message_at,
      v_queue_id,
      v_assistant_id,
      'open'
    )
    RETURNING id INTO v_ticket_id;
    
    RAISE LOG '✅ [UPSERT-TICKET] Novo ticket criado: % (fila: %, assistente: %, client_id: %)', v_ticket_id, v_queue_id, v_assistant_id, v_actual_client_id;
  END IF;
  
  -- CAMADA DE SEGURANÇA FINAL: Verificar se o ticket final tem fila mas não tem assistente
  SELECT ct.assigned_queue_id, ct.assigned_assistant_id 
  INTO v_queue_id, v_final_assistant_id
  FROM public.conversation_tickets ct
  WHERE ct.id = v_ticket_id;
  
  -- CORREÇÃO FINAL: Se ainda tem fila mas não tem assistente, corrigir agora
  IF v_queue_id IS NOT NULL AND v_final_assistant_id IS NULL THEN
    SELECT assistant_id INTO v_final_assistant_id
    FROM public.queues 
    WHERE id = v_queue_id AND is_active = true;
    
    IF v_final_assistant_id IS NOT NULL THEN
      UPDATE public.conversation_tickets 
      SET assigned_assistant_id = v_final_assistant_id,
          updated_at = now()
      WHERE id = v_ticket_id;
      
      RAISE LOG '🛡️ [UPSERT-TICKET] SEGURANÇA FINAL: Assistente corrigido para ticket %: fila % -> assistente % (client_id: %)', 
        v_ticket_id, v_queue_id, v_final_assistant_id, v_actual_client_id;
    ELSE
      RAISE LOG '❌ [UPSERT-TICKET] FALHA CRÍTICA: Fila % não tem assistente ativo! (client_id: %)', v_queue_id, v_actual_client_id;
    END IF;
  ELSIF v_queue_id IS NOT NULL AND v_final_assistant_id IS NOT NULL THEN
    RAISE LOG '✅ [UPSERT-TICKET] VERIFICAÇÃO FINAL OK: Ticket % tem fila % e assistente % (client_id: %)', 
      v_ticket_id, v_queue_id, v_final_assistant_id, v_actual_client_id;
  ELSIF v_queue_id IS NULL THEN
    RAISE LOG '⚠️ [UPSERT-TICKET] ATENÇÃO: Ticket % sem fila atribuída (client_id: %)', v_ticket_id, v_actual_client_id;
  END IF;
  
  RETURN v_ticket_id;
END;
$function$