import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Servidor Supabase
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Extrair informações do trigger
  let triggerInfo = { type: 'unknown', chatId: null };
  try {
    const body = await req.text();
    if (body) {
      const data = JSON.parse(body);
      triggerInfo = {
        type: data.trigger || 'unknown',
        chatId: data.chatId || null
      };
    }
  } catch (e) {
    // Ignore parsing errors for trigger info
  }

  console.log('🤖 [PROCESS-BATCHES] Verificando batches pendentes...', {
    trigger: triggerInfo.type,
    chatId: triggerInfo.chatId?.substring(0, 20),
    timestamp: new Date().toISOString()
  });

  try {
    const processingId = `${triggerInfo.type}_${Date.now()}`;
    
    // 🧠 TIMING INTELIGENTE POR TIPO DE MÍDIA
    let cutoffTime: string;
    const lockTimeout = new Date(Date.now() - 30000).toISOString(); // 30 segundos para timeout
    
    // Verificar tipo de conteúdo nos batches para determinar timeout
    const { data: batchPreview } = await supabase
      .from('message_batches')
      .select('id, messages, created_at')
      .order('created_at', { ascending: true })
      .limit(5);
    
    let adaptiveTimeout = 3000; // Padrão: 3s para texto
    
    if (batchPreview && batchPreview.length > 0) {
      for (const batch of batchPreview) {
        const messages = batch.messages || [];
        const hasAudio = messages.some((msg: any) => 
          (msg.content && typeof msg.content === 'string' && msg.content.includes('🎵 Áudio')) || msg.messageType === 'audio'
        );
        const hasImage = messages.some((msg: any) => 
          (msg.content && typeof msg.content === 'string' && msg.content.includes('📷 Imagem')) || msg.messageType === 'image'
        );
        const hasMixed = hasAudio && hasImage;
        const hasText = messages.some((msg: any) => 
          msg.content && typeof msg.content === 'string' && !msg.content.includes('🎵 Áudio') && !msg.content.includes('📷 Imagem')
        );
        
        if (hasMixed) {
          adaptiveTimeout = Math.max(adaptiveTimeout, 10000); // 10s para misto
        } else if (hasAudio || hasImage) {
          adaptiveTimeout = Math.max(adaptiveTimeout, 8000); // 8s para mídia
        } else if (hasText) {
          adaptiveTimeout = Math.max(adaptiveTimeout, 3000); // 3s para texto
        }
      }
    }
    
    cutoffTime = new Date(Date.now() - adaptiveTimeout).toISOString();
    
    console.log('🧠 [ADAPTIVE-TIMING] Timeout calculado:', {
      adaptiveTimeout: `${adaptiveTimeout}ms`,
      tipo: adaptiveTimeout === 10000 ? 'misto (10s)' : adaptiveTimeout === 8000 ? 'mídia (8s)' : 'texto (3s)'
    });
    
    // BUSCAR BATCHES DISPONÍVEIS (não processados E não em processamento)
    const { data: pendingBatches, error } = await supabase
      .from('message_batches')
      .select('*')
      .lt('last_updated', cutoffTime)
      .or(`processing_started_at.is.null,processing_started_at.lt.${lockTimeout}`)
      .order('created_at', { ascending: true })
      .limit(3);

    if (error) {
      console.error('🤖 [PROCESS-BATCHES] ❌ Erro ao buscar batches:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🤖 [PROCESS-BATCHES] 📦 Encontrados', pendingBatches?.length || 0, 'batches pendentes');

    if (!pendingBatches || pendingBatches.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum batch pendente',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 🎵 CORREÇÃO: Aguardar 500ms para garantir que dados de mídia/áudio estejam salvos
    console.log('🎵 [AUDIO-FIX] ⏳ Aguardando 500ms para garantir dados de mídia salvos...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // BLOQUEAR BATCHES PARA PROCESSAMENTO (evitar duplicação)
    const batchIds = pendingBatches.map(b => b.id);
    const { data: lockedBatches, error: lockError } = await supabase
      .from('message_batches')
      .update({
        processing_started_at: new Date().toISOString(),
        processing_by: processingId
      })
      .in('id', batchIds)
      .is('processing_started_at', null)
      .select('id');

    if (lockError) {
      console.error('🤖 [PROCESS-BATCHES] ❌ Erro ao bloquear batches:', lockError);
      return new Response(JSON.stringify({ error: lockError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const lockedBatchIds = lockedBatches?.map(b => b.id) || [];
    const batchesToProcess = pendingBatches.filter(b => lockedBatchIds.includes(b.id));
    
    console.log('🤖 [PROCESS-BATCHES] 🔒 Bloqueados', lockedBatchIds.length, 'de', batchIds.length, 'batches para processamento');

    if (batchesToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Nenhum batch disponível para processamento (já sendo processados)',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processedCount = 0;
    
    console.log('🤖 [PROCESS-BATCHES] 🚀 Processando', batchesToProcess.length, 'batches em paralelo');
    
    const batchPromises = batchesToProcess.map(async (batch) => {
      console.log('🤖 [PROCESS-BATCHES] 🚀 Processando batch:', batch.id, 'com', batch.messages?.length || 0, 'mensagens');
      
      try {
        await processBatch(batch);
        return { success: true, batchId: batch.id };
      } catch (error) {
        console.error('🤖 [PROCESS-BATCHES] ❌ Erro ao processar batch:', batch.id, error);
        return { success: false, batchId: batch.id, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(batchPromises);
    processedCount = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    return new Response(JSON.stringify({ 
      success: true,
      processed: processedCount,
      total: pendingBatches.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🤖 [PROCESS-BATCHES] ❌ Erro geral:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * PROCESSAR UM BATCH ESPECÍFICO
 */
async function processBatch(batch: any) {
  console.log('🤖 [PROCESS-BATCH] Processando batch:', batch.id);

  try {
    const messages = batch.messages || [];
    
    // 🔍 DETECTAR COMANDOS DE MÍDIA RELACIONADA NO BATCH
    const detectsFutureMedia = (content: string): boolean => {
      if (!content || typeof content !== 'string') return false;
      
      const futureMediaPatterns = [
        /vou.*enviar.*imagem/i,
        /vou.*mandar.*imagem/i,
        /analise.*imagem.*que.*vou/i,
        /olha.*imagem.*que.*vou/i,
        /vê.*imagem.*que.*vou/i,
        /mando.*imagem/i,
        /envio.*imagem/i,
        /te.*mando/i,
        /te.*envio/i,
        /próxima.*imagem/i,
        /agora.*imagem/i,
        /depois.*imagem/i
      ];
      
      return futureMediaPatterns.some(pattern => pattern.test(content));
    };

    // 🎵 DETECÇÃO MELHORADA DE MENSAGENS DE ÁUDIO
    const audioMessages = messages.filter((msg: any) => {
      if (msg.messageType === 'audio') return true;
      if (typeof msg.content === 'string' && msg.content.includes('🎵 Áudio')) return true;
      if (typeof msg.content === 'object' && msg.content?.mimetype?.startsWith('audio/')) return true;
      return false;
    });

    // 🖼️ DETECÇÃO MELHORADA DE MENSAGENS DE IMAGEM
    const imageMessages = messages.filter((msg: any) => {
      if (msg.messageType === 'image') return true;
      if (typeof msg.content === 'string' && msg.content.includes('📷 Imagem')) return true;
      if (typeof msg.content === 'object' && msg.content?.mimetype?.startsWith('image/')) return true;
      return false;
    });

    // 📄 DETECÇÃO DE DOCUMENTOS
    const documentMessages = messages.filter((msg: any) => {
      if (msg.messageType === 'document') return true;
      if (typeof msg.content === 'object' && (msg.content?.fileName || msg.content?.title)) return true;
      if (typeof msg.content === 'object' && msg.content?.mimetype === 'application/pdf') return true;
      return false;
    });

    // 🔗 VERIFICAR SE HÁ COMANDOS QUE REFERENCIAM MÍDIA FUTURA
    const mediaCommandMessages = messages.filter((msg: any) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return detectsFutureMedia(content);
    });

    // 📊 LOG DO CONTEXTO DO BATCH
    console.log('🔍 [BATCH-CONTEXT] Análise do batch:', {
      totalMessages: messages.length,
      audioCount: audioMessages.length,
      imageCount: imageMessages.length,
      documentCount: documentMessages.length,
      mediaCommandCount: mediaCommandMessages.length,
      hasRelatedMedia: mediaCommandMessages.length > 0 && (audioMessages.length > 0 || imageMessages.length > 0)
    });

    if (audioMessages.length > 0) {
      console.log('🎵 [AUDIO-FIX] 🔍 Detectados', audioMessages.length, 'áudios no batch');
    }

    if (imageMessages.length > 0) {
      console.log('🖼️ [IMAGE-FIX] 🔍 Detectados', imageMessages.length, 'imagens no batch');
      
      // Verificar se dados de imagem estão disponíveis no banco E em ticket_messages
      for (const imageMsg of imageMessages) {
        console.log('🖼️ [IMAGE-FIX] 🔍 Verificando dados de imagem para messageId:', imageMsg.messageId);
        
        // Verificar dados na tabela ticket_messages (para imagens, focamos no image_base64)
        const { data: ticketData } = await supabase
          .from('ticket_messages')
          .select('message_id, image_base64, media_url, media_key, message_type, processing_status')
          .eq('message_id', imageMsg.messageId)
          .single();
        
        console.log('🖼️ [IMAGE-VERIFICATION] 📊 STATUS DOS DADOS:', {
          messageId: imageMsg.messageId,
          ticketMessages: ticketData ? {
            hasImageBase64: !!ticketData.image_base64,
            hasMediaUrl: !!ticketData.media_url,
            hasMediaKey: !!ticketData.media_key,
            messageType: ticketData.message_type,
            processingStatus: ticketData.processing_status
          } : 'NÃO ENCONTRADO'
        });

        // ✅ VERIFICAR SE IMAGE_BASE64 ESTÁ DISPONÍVEL
        if (!ticketData || !ticketData.image_base64) {
          console.log('⚠️ [IMAGE-VERIFICATION] ⚠️ image_base64 não encontrado, aguardando processamento:', imageMsg.messageId);
          
          // Aguardar tempo para processamento da imagem
          console.log('🖼️ [IMAGE-VERIFICATION] ⏳ Aguardando processamento de imagem...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Verificar novamente após aguardar
          const { data: updatedTicketData } = await supabase
            .from('ticket_messages')
            .select('message_id, image_base64')
            .eq('message_id', imageMsg.messageId)
            .single();
          
          if (updatedTicketData?.image_base64) {
            console.log('✅ [IMAGE-VERIFICATION] ✅ image_base64 disponível após aguardar:', imageMsg.messageId);
          } else {
            console.log('❌ [IMAGE-VERIFICATION] ❌ image_base64 ainda não disponível:', imageMsg.messageId);
          }
        } else {
          console.log('✅ [IMAGE-VERIFICATION] ✅ image_base64 já disponível:', imageMsg.messageId);
        }
      }
    }

    // Processar áudios se houver
    if (audioMessages.length > 0) {
      // Verificar se dados de áudio estão disponíveis no banco E em ticket_messages
      for (const audioMsg of audioMessages) {
        console.log('🎵 [AUDIO-FIX] 🔍 Verificando dados de áudio para messageId:', audioMsg.messageId);
        
        // Verificar dados na tabela whatsapp_messages (fonte primária)
        const { data: whatsappData } = await supabase
          .from('whatsapp_messages')
          .select('message_id, media_url, media_key, file_enc_sha256, message_type, created_at')
          .eq('message_id', audioMsg.messageId)
          .single();
        
        // Verificar dados na tabela ticket_messages
        const { data: ticketData } = await supabase
          .from('ticket_messages')
          .select('message_id, media_url, media_key, file_enc_sha256, message_type, processing_status')
          .eq('message_id', audioMsg.messageId)
          .single();
        
        console.log('🎵 [AUDIO-VERIFICATION] 📊 STATUS DOS DADOS:', {
          messageId: audioMsg.messageId,
          whatsappMessages: whatsappData ? {
            hasMediaUrl: !!whatsappData.media_url,
            hasMediaKey: !!whatsappData.media_key,
            hasFileEncSha256: !!whatsappData.file_enc_sha256,
            messageType: whatsappData.message_type
          } : 'NÃO ENCONTRADO',
          ticketMessages: ticketData ? {
            hasMediaUrl: !!ticketData.media_url,
            hasMediaKey: !!ticketData.media_key,
            hasFileEncSha256: !!ticketData.file_enc_sha256,
            messageType: ticketData.message_type,
            processingStatus: ticketData.processing_status
          } : 'NÃO ENCONTRADO'
        });

        // 🎯 SINCRONIZAÇÃO AUTOMÁTICA: Garantir dados em ticket_messages
        if (whatsappData && whatsappData.media_url && whatsappData.media_key) {
          if (!ticketData || !ticketData.media_url || !ticketData.media_key) {
            console.log('🔧 [AUDIO-VERIFICATION] 🚀 SINCRONIZANDO dados para ticket_messages...');
            
            const { error: syncError } = await supabase
              .from('ticket_messages')
              .update({
                media_url: whatsappData.media_url,
                media_key: whatsappData.media_key,
                file_enc_sha256: whatsappData.file_enc_sha256,
                processing_status: 'received'
              })
              .eq('message_id', audioMsg.messageId);
            
            if (!syncError) {
              console.log('✅ [AUDIO-VERIFICATION] 🎯 Dados sincronizados com sucesso:', audioMsg.messageId);
            } else {
              console.error('❌ [AUDIO-VERIFICATION] Erro ao sincronizar:', audioMsg.messageId, syncError);
            }
          } else {
            console.log('✅ [AUDIO-VERIFICATION] ✅ Dados já sincronizados:', audioMsg.messageId);
          }
        } else {
          console.log('⚠️ [AUDIO-VERIFICATION] ⚠️ Dados de áudio não encontrados:', audioMsg.messageId);
          
          // Aguardar mais tempo para dados de mídia
          console.log('🎵 [AUDIO-VERIFICATION] ⏳ Aguardando mais tempo para dados de mídia...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // BUSCAR TICKET
    const { data: ticketData } = await supabase
      .from('conversation_tickets')
      .select('*')
      .eq('chat_id', batch.chat_id)
      .eq('client_id', batch.client_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let ticket = ticketData;

    if (!ticket) {
      console.log('🤖 [PROCESS-BATCH] ❌ Ticket não encontrado - CRIANDO NOVO TICKET');
      
      // CRIAR TICKET ANTES DE PROCESSAR
      const newTicket = await createTicketFromBatch(batch);
      if (!newTicket) {
        console.error('🤖 [PROCESS-BATCH] ❌ Falha ao criar ticket');
        await deleteBatch(batch.id);
        return;
      }
      
      // Usar o ticket recém-criado
      ticket = newTicket;
    }

    // 🎯 PROCESSAMENTO UNIFICADO: DESCRIPTOGRAFIA + ANÁLISE + TRANSCRIÇÃO DENTRO DO BATCH
    console.log('🔄 [UNIFIED-PROCESSING] Iniciando processamento unificado de mídias no batch');
    
    // PROCESSAR DESCRIPTOGRAFIA DE MÍDIAS PRIMEIRO
    await processMediaDecryption(batch, audioMessages, imageMessages);
    
    // PROCESSAR ANÁLISE E TRANSCRIÇÃO DE MÍDIAS
    await processMediaAnalysis(batch, audioMessages, imageMessages);
    
    // 📝 PREPARAR MENSAGENS PARA IA (SIMPLIFICADO - SEM AGUARDAR TRANSCRIÇÃO)
    console.log('📝 [PROCESS-BATCH] Mensagens do batch (com transcrições):', JSON.stringify(messages, null, 2));
    
    // ✅ LÓGICA SIMPLIFICADA: Batches agora só são criados APÓS transcrição, então processar diretamente
    const processedMessages = messages.map((msg: any) => {
      console.log('✅ [SIMPLIFIED-PROCESSING] Processando mensagem já transcrita:', msg.messageId);
      return msg;
    });

    // 🎥 DETECTAR COMANDOS DE VÍDEO NO BATCH
    const hasVideoCommands = processedMessages.some((msg: any) => {
      const content = msg.content || '';
      const isVideoCommand = /^video\s+([a-zA-Z0-9_-]+)$/i.test(content.trim());
      console.log('🎥 [PROCESS-BATCH] Verificando comando de vídeo:', {
        content: content,
        isVideoCommand: isVideoCommand,
        messageId: msg.messageId
      });
      return isVideoCommand;
    });

    console.log('🎥 [PROCESS-BATCH] Comandos de vídeo detectados no batch:', hasVideoCommands);

    // 🔗 PROCESSAMENTO CONTEXTUAL INTELIGENTE
    let contextualMessage = '';
    
    // Se há comandos de mídia relacionada, criar contexto combinado
    if (mediaCommandMessages.length > 0 && (audioMessages.length > 0 || imageMessages.length > 0)) {
      console.log('🔗 [CONTEXTUAL-PROCESSING] Criando contexto combinado para mídia relacionada');
      
      // Combinar comandos de áudio com imagens subsequentes
      contextualMessage = processedMessages.map(msg => {
        if (msg.content && detectsFutureMedia(msg.content)) {
          return msg.content + ' [Este comando refere-se à mídia seguinte]';
        }
        return msg.content || (msg.messageType === 'image' ? '📷 Imagem' : '🎵 Áudio');
      }).join(' ');
      
      console.log('🔗 [CONTEXTUAL-PROCESSING] Contexto combinado criado:', {
        hasCommands: mediaCommandMessages.length > 0,
        hasAudio: audioMessages.length > 0,
        hasImage: imageMessages.length > 0,
        contextLength: contextualMessage.length
      });
    } else {
      // Processamento normal
      contextualMessage = processedMessages.map(msg => msg.content || '').join(' ');
    }

    // CHAMAR IA COM BATCH (usando mensagens com transcrição)
    console.log('🤖 [PROCESS-BATCH] 🧠 Chamando IA para ticket:', ticket.id, 'com', processedMessages?.length || 0, 'mensagens');
    console.log('🤖 [PROCESS-BATCH] 📄 Mensagens do batch (com transcrições):', JSON.stringify(processedMessages, null, 2));
    
    const aiResponse = await supabase.functions.invoke('ai-assistant-process', {
      body: {
        ticketId: ticket.id,
        messages: processedMessages, // Usar mensagens com transcrição
        context: {
          chatId: batch.chat_id,
          customerName: processedMessages[0]?.customerName || 'Cliente',
          phoneNumber: processedMessages[0]?.phoneNumber || '',
          batchInfo: `Batch de ${processedMessages.length} mensagens (${processedMessages.filter(m => m.isTranscribed).length} transcritas)`,
          hasRelatedMedia: mediaCommandMessages.length > 0 && (audioMessages.length > 0 || imageMessages.length > 0),
          contextualMessage: contextualMessage
        }
      }
    });

    console.log('🤖 [PROCESS-BATCH] 🎯 Resultado da IA:', { 
      success: !aiResponse.error, 
      hasError: !!aiResponse.error,
      errorMsg: aiResponse.error?.message 
    });

    if (!aiResponse.error) {
      console.log('🤖 [PROCESS-BATCH] ✅ IA processou com SUCESSO!');
      
      // MARCAR MENSAGENS COMO PROCESSADAS
      await markMessagesAsProcessed(batch.messages);
    }

    // REMOVER BATCH PROCESSADO
    await deleteBatch(batch.id);

  } catch (error) {
    console.error('🤖 [PROCESS-BATCH] ❌ Erro ao processar batch:', error);
    await deleteBatch(batch.id);
    throw error;
  }
}

/**
 * MARCAR MENSAGENS COMO PROCESSADAS (OTIMIZADO)
 */
async function markMessagesAsProcessed(messages: any[]) {
  const messageIds = messages.map(msg => msg.messageId).filter(Boolean);
  
  if (messageIds.length === 0) return;

  // Verificar quais já estão processadas para evitar updates desnecessários
  const { data: alreadyProcessed } = await supabase
    .from('whatsapp_messages')
    .select('message_id')
    .in('message_id', messageIds)
    .eq('is_processed', true);

  const alreadyProcessedIds = new Set(alreadyProcessed?.map(m => m.message_id) || []);
  const toProcess = messageIds.filter(id => !alreadyProcessedIds.has(id));

  if (toProcess.length === 0) {
    console.log('🤖 [MARK-PROCESSED] ℹ️ Todas as mensagens já estão processadas');
    return;
  }

  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ 
      is_processed: true,
      processed_at: new Date().toISOString()
    })
    .in('message_id', toProcess);

  if (error) {
    console.error('🤖 [MARK-PROCESSED] ❌ Erro ao marcar mensagens:', error);
  } else {
    console.log(`🤖 [MARK-PROCESSED] ✅ Marcadas ${toProcess.length} mensagens como processadas (${alreadyProcessedIds.size} já estavam processadas)`);
  }
}

/**
 * DELETAR BATCH PROCESSADO
 */
async function deleteBatch(batchId: string) {
  const { error } = await supabase
    .from('message_batches')
    .delete()
    .eq('id', batchId);

  if (error) {
    console.error('🤖 [DELETE-BATCH] ❌ Erro ao deletar batch:', error);
  } else {
    console.log('🤖 [DELETE-BATCH] ✅ Batch deletado:', batchId);
  }
}

/**
 * CRIAR TICKET A PARTIR DO BATCH
 */
async function createTicketFromBatch(batch: any) {
  console.log('🤖 [CREATE-TICKET] Criando ticket para batch:', batch.id);
  
  try {
    const firstMessage = batch.messages[0];
    const customerName = firstMessage?.customerName || 'Cliente';
    const phoneNumber = firstMessage?.phoneNumber || '';
    const chatId = batch.chat_id;
    const instanceId = batch.instance_id;
    const clientId = batch.client_id;
    
    // Usar a função RPC do Supabase para criar/buscar ticket
    const { data: ticketId, error: rpcError } = await supabase.rpc('upsert_conversation_ticket', {
      p_client_id: clientId,
      p_chat_id: chatId,
      p_instance_id: instanceId,
      p_customer_name: customerName,
      p_customer_phone: phoneNumber,
      p_last_message: firstMessage?.content || '',
      p_last_message_at: new Date().toISOString()
    });

    if (rpcError) {
      console.error('🤖 [CREATE-TICKET] ❌ Erro RPC:', rpcError);
      return null;
    }

    // Buscar o ticket criado
    const { data: ticket, error: fetchError } = await supabase
      .from('conversation_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchError) {
      console.error('🤖 [CREATE-TICKET] ❌ Erro ao buscar ticket:', fetchError);
      return null;
    }

    console.log('🤖 [CREATE-TICKET] ✅ Ticket criado/encontrado:', ticket.id);
    return ticket;
    
  } catch (error) {
    console.error('🤖 [CREATE-TICKET] ❌ Erro geral:', error);
    return null;
  }
}

/**
 * 🎯 PROCESSAMENTO UNIFICADO: DESCRIPTOGRAFIA DE MÍDIAS DENTRO DO BATCH
 */
async function processMediaDecryption(batch: any, audioMessages: any[], imageMessages: any[]) {
  console.log('🔐 [UNIFIED-DECRYPT] Iniciando descriptografia unificada:', {
    totalAudios: audioMessages.length,
    totalImages: imageMessages.length
  });
  
  // Buscar client_id e instance_id para obter business token
  const { data: clientData } = await supabase
    .from('whatsapp_instances')
    .select(`
      client_id,
      instance_id,
      clients!inner (
        business_token
      )
    `)
    .eq('instance_id', batch.instance_id)
    .single();
  
  if (!clientData?.clients?.business_token) {
    console.log('⚠️ [UNIFIED-DECRYPT] Business token não encontrado');
    return;
  }
  
  const businessToken = clientData.clients.business_token;
  const decryptionPromises = [];
  
  // Processar descriptografia de imagens
  for (const imageMsg of imageMessages) {
    decryptionPromises.push(
      processImageDecryption(imageMsg.messageId, batch.instance_id, businessToken)
    );
  }
  
  // Processar descriptografia de áudios
  for (const audioMsg of audioMessages) {
    decryptionPromises.push(
      processAudioDecryption(audioMsg.messageId, batch.instance_id, businessToken)
    );
  }
  
  if (decryptionPromises.length > 0) {
    console.log(`🔐 [UNIFIED-DECRYPT] Processando ${decryptionPromises.length} mídias em paralelo`);
    await Promise.allSettled(decryptionPromises);
    console.log('✅ [UNIFIED-DECRYPT] Descriptografia concluída');
  }
}

/**
 * 🧠 PROCESSAMENTO UNIFICADO: ANÁLISE DE MÍDIAS DENTRO DO BATCH
 */
async function processMediaAnalysis(batch: any, audioMessages: any[], imageMessages: any[]) {
  console.log('🧠 [UNIFIED-ANALYSIS] Iniciando análise unificada:', {
    totalAudios: audioMessages.length,
    totalImages: imageMessages.length
  });
  
  // Buscar configuração de OpenAI do cliente
  const { data: aiConfig } = await supabase
    .from('client_ai_configs')
    .select('openai_api_key')
    .eq('client_id', batch.client_id)
    .single();
  
  if (!aiConfig?.openai_api_key) {
    console.log('⚠️ [UNIFIED-ANALYSIS] OpenAI API key não encontrada');
    return;
  }
  
  const analysisPromises = [];
  
  // Processar análise de imagens
  for (const imageMsg of imageMessages) {
    analysisPromises.push(
      processImageAnalysis(imageMsg.messageId, aiConfig.openai_api_key)
    );
  }
  
  // Processar análise de áudios  
  for (const audioMsg of audioMessages) {
    analysisPromises.push(
      processAudioContextualAnalysis(audioMsg.messageId, aiConfig.openai_api_key)
    );
  }
  
  if (analysisPromises.length > 0) {
    console.log(`🧠 [UNIFIED-ANALYSIS] Processando ${analysisPromises.length} análises em paralelo`);
    await Promise.allSettled(analysisPromises);
    console.log('✅ [UNIFIED-ANALYSIS] Análise concluída');
  }
}

/**
 * 🖼️ DESCRIPTOGRAFAR IMAGEM INDIVIDUAL
 */
async function processImageDecryption(messageId: string, instanceId: string, businessToken: string) {
  try {
    console.log('🖼️ [IMAGE-DECRYPT] Descriptografando:', messageId);
    
    // Buscar dados da imagem
    const { data: imageData } = await supabase
      .from('ticket_messages')
      .select('media_url, media_key, media_mime_type')
      .eq('message_id', messageId)
      .eq('message_type', 'image')
      .single();
    
    if (!imageData?.media_url || !imageData?.media_key) {
      console.log('⚠️ [IMAGE-DECRYPT] Dados incompletos para:', messageId);
      return;
    }
    
    // Chamar API de descriptografia
    const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/media/directly-download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: 'image',
        url: imageData.media_url,
        mediaKey: imageData.media_key,
        mimetype: imageData.media_mime_type || 'image/jpeg'
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Salvar imagem descriptografada
      await supabase
        .from('ticket_messages')
        .update({
          image_base64: result.media,
          processing_status: 'decrypted'
        })
        .eq('message_id', messageId);
      
      console.log('✅ [IMAGE-DECRYPT] Sucesso:', messageId);
    } else {
      console.log('❌ [IMAGE-DECRYPT] Falha API:', response.status);
    }
    
  } catch (error) {
    console.error('❌ [IMAGE-DECRYPT] Erro:', messageId, error);
  }
}

/**
 * 🎵 DESCRIPTOGRAFAR ÁUDIO INDIVIDUAL
 */
async function processAudioDecryption(messageId: string, instanceId: string, businessToken: string) {
  try {
    console.log('🎵 [AUDIO-DECRYPT] Descriptografando:', messageId);
    
    // ✅ VERIFICAÇÃO CRÍTICA: Se já está processado, não reprocessar
    const { data: currentStatus } = await supabase
      .from('ticket_messages')
      .select('audio_base64, processing_status, media_url, media_key, media_mime_type')
      .eq('message_id', messageId)
      .eq('message_type', 'audio')
      .single();
    
    if (currentStatus?.audio_base64) {
      console.log('✅ [AUDIO-DECRYPT] Áudio já descriptografado - pulando:', messageId);
      return;
    }
    
    if (!currentStatus?.media_url || !currentStatus?.media_key) {
      console.log('⚠️ [AUDIO-DECRYPT] Dados incompletos para:', messageId);
      return;
    }
    
    const audioData = currentStatus;
    
    // 🔧 CORREÇÃO CRÍTICA: Converter media_key se estiver em formato objeto
    let mediaKey = audioData.media_key;
    if (typeof mediaKey === 'object' && mediaKey !== null) {
      console.log('🔄 [AUDIO-DECRYPT] Convertendo media_key de objeto para Base64');
      mediaKey = convertToBase64Robust(mediaKey);
      if (!mediaKey) {
        console.error('❌ [AUDIO-DECRYPT] Falha na conversão de media_key:', messageId);
        return;
      }
    }
    
    // Chamar API de descriptografia
    const response = await fetch(`https://api.yumer.com.br/api/v2/instance/${instanceId}/media/directly-download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${businessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: 'audio',
        url: audioData.media_url,
        mediaKey: mediaKey,
        mimetype: audioData.media_mime_type || 'audio/ogg'
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // 🔧 VALIDAR FORMATO DE ÁUDIO antes de salvar
      const audioBase64 = result.media;
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        console.error('❌ [AUDIO-DECRYPT] Áudio descriptografado inválido:', messageId);
        return;
      }
      
      // Verificar se é Base64 válido e tem header correto
      try {
        const audioBytes = atob(audioBase64.substring(0, 50)); // Verificar header
        console.log('✅ [AUDIO-DECRYPT] Áudio descriptografado validado:', {
          messageId,
          size: audioBase64.length,
          headerBytes: audioBytes.slice(0, 10).split('').map(c => c.charCodeAt(0)).join(' ')
        });
      } catch (headerError) {
        console.error('❌ [AUDIO-DECRYPT] Header de áudio inválido:', messageId, headerError);
        return;
      }
      
      // Salvar áudio descriptografado
      await supabase
        .from('ticket_messages')
        .update({
          audio_base64: audioBase64,
          processing_status: 'decrypted'
        })
        .eq('message_id', messageId);
      
      console.log('✅ [AUDIO-DECRYPT] Sucesso:', messageId);
    } else {
      const errorText = await response.text();
      console.log('❌ [AUDIO-DECRYPT] Falha API:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ [AUDIO-DECRYPT] Erro:', messageId, error);
    
    // Marcar como failed para evitar loops
    await supabase
      .from('ticket_messages')
      .update({ processing_status: 'failed' })
      .eq('message_id', messageId);
  }
}

/**
 * 🔧 CONVERTER DADOS PARA BASE64 DE FORMA ROBUSTA
 */
function convertToBase64Robust(data: any): string | null {
  try {
    if (!data) return null;
    
    // Se já é string Base64, retornar como está
    if (typeof data === 'string') {
      return data;
    }
    
    // Se é objeto {0: 165, 1: 232, ...} (Uint8Array serializado)
    if (typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
      if (keys.length > 0 && keys.every(k => !isNaN(k) && k >= 0)) {
        const bytes = new Uint8Array(keys.length);
        keys.forEach((key, index) => {
          bytes[index] = data[key];
        });
        return btoa(String.fromCharCode(...bytes));
      }
    }
    
    // Se é array de bytes
    if (Array.isArray(data)) {
      const bytes = new Uint8Array(data);
      return btoa(String.fromCharCode(...bytes));
    }
    
    console.warn('🔧 [CONVERT-BASE64] Tipo não reconhecido:', typeof data);
    return null;
  } catch (error) {
    console.error('❌ [CONVERT-BASE64] Erro:', error);
    return null;
  }
}

/**
 * 🖼️ ANALISAR IMAGEM COM GPT-4 VISION
 */
async function processImageAnalysis(messageId: string, apiKey: string) {
  try {
    console.log('🖼️ [IMAGE-ANALYSIS] Analisando:', messageId);
    
    // Buscar imagem descriptografada
    const { data: imageData } = await supabase
      .from('ticket_messages')
      .select('image_base64')
      .eq('message_id', messageId)
      .single();
    
    if (!imageData?.image_base64) {
      console.log('⚠️ [IMAGE-ANALYSIS] Imagem não disponível:', messageId);
      return;
    }
    
    // Processar com GPT-4 Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analise esta imagem de forma detalhada e descreva o que você vê. Inclua elementos visuais importantes, texto se houver, objetos, pessoas, ações, contexto e qualquer informação relevante para atendimento ao cliente.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageData.image_base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 800
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      const analysis = result.choices[0].message.content;
      
      // Salvar análise
      await supabase
        .from('ticket_messages')
        .update({
          media_transcription: analysis,
          processing_status: 'analyzed'
        })
        .eq('message_id', messageId);
      
      console.log('✅ [IMAGE-ANALYSIS] Análise salva:', messageId);
    } else {
      console.log('❌ [IMAGE-ANALYSIS] Falha API:', response.status);
    }
    
  } catch (error) {
    console.error('❌ [IMAGE-ANALYSIS] Erro:', messageId, error);
  }
}

/**
 * 🎵 ANÁLISE CONTEXTUAL DE ÁUDIO
 */
async function processAudioContextualAnalysis(messageId: string, apiKey: string) {
  try {
    console.log('🎵 [AUDIO-ANALYSIS] Analisando contexto:', messageId);
    
    // Buscar transcrição existente
    const { data: audioData } = await supabase
      .from('ticket_messages')
      .select('content, media_transcription')
      .eq('message_id', messageId)
      .single();
    
    if (!audioData?.content || audioData.content === '🎵 Áudio') {
      console.log('⚠️ [AUDIO-ANALYSIS] Transcrição não disponível:', messageId);
      return;
    }
    
    // Se já tem análise, pular
    if (audioData.media_transcription) {
      console.log('ℹ️ [AUDIO-ANALYSIS] Análise já existe:', messageId);
      return;
    }
    
    // Processar análise contextual com GPT-4
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente especializado em análise de áudios para atendimento ao cliente. Analise a transcrição fornecida e extraia informações relevantes como: sentimento, intenção, urgência, palavras-chave importantes, e contexto da mensagem.'
          },
          {
            role: 'user',
            content: `Analise esta transcrição de áudio: "${audioData.content}"`
          }
        ],
        max_tokens: 800
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      const analysis = result.choices[0].message.content;
      
      // Salvar análise contextual
      await supabase
        .from('ticket_messages')
        .update({
          media_transcription: analysis,
          processing_status: 'analyzed'
        })
        .eq('message_id', messageId);
      
      console.log('✅ [AUDIO-ANALYSIS] Análise contextual salva:', messageId);
    } else {
      console.log('❌ [AUDIO-ANALYSIS] Falha API:', response.status);
    }
    
  } catch (error) {
    console.error('❌ [AUDIO-ANALYSIS] Erro:', messageId, error);
  }
}

/**
 * PROCESSAR MENSAGEM INDIVIDUAL (FALLBACK)
 */
async function processSingleMessage(message: any) {
  console.log('🤖 [SINGLE-MESSAGE] Processando mensagem individual como fallback');
  return { success: true };
}