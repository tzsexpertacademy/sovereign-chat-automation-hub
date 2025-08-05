import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { aiConfigService } from '@/services/aiConfigService';
import { audioRecoveryService } from '@/services/audioRecoveryService';

/**
 * Hook para processar áudios automaticamente quando recebidos
 */
export const useAudioAutoProcessor = (clientId: string) => {
  const processingRef = useRef<Set<string>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const processingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const clientProcessingCount = useRef<number>(0);
  const lastRealtimeActivity = useRef<number>(0);
  
  // Configurações otimizadas
  const PROCESSING_TIMEOUT = 120000; // 2 minutos
  const MAX_CONCURRENT_PROCESSING = 3;
  const POLLING_COOLDOWN = 30000; // 30 segundos
  const REALTIME_INACTIVE_THRESHOLD = 60000; // 1 minuto

  useEffect(() => {
    if (!clientId) {
      console.log('🎵 [AUDIO-AUTO] ❌ ClientId não fornecido - hook não ativo');
      return;
    }

    console.log('🎵 [AUDIO-AUTO] ✅ INICIANDO processamento automático de áudios para cliente:', clientId);
    console.log('🎵 [AUDIO-AUTO] 🔧 Hook ativo e configurado corretamente');
    console.log('🎵 [AUDIO-AUTO] 🔧 Timestamp de inicialização:', new Date().toISOString());
    
    // Verificar se há áudios órfãos para reprocessar
    audioRecoveryService.findOrphanedAudios(clientId).then(orphaned => {
      if (orphaned.length > 0) {
        console.log(`🔄 [AUDIO-AUTO] Encontrados ${orphaned.length} áudios órfãos - use audioRecovery.reprocessOrphanedAudios('${clientId}') para reprocessar`);
      }
    }).catch(console.error);

    // 🎯 IMPLEMENTAR FALLBACK DE POLLING OTIMIZADO
    const checkPendingAudios = async () => {
      try {
        // Verificar se realtime está ativo recentemente
        const realtimeInactive = Date.now() - lastRealtimeActivity.current > REALTIME_INACTIVE_THRESHOLD;
        const shouldPoll = realtimeInactive || processingRef.current.size === 0;
        
        if (!shouldPoll) {
          console.log('⏭️ [AUDIO-AUTO] POLLING pausado - realtime ativo');
          return;
        }

        // Limitar processamentos simultâneos
        if (clientProcessingCount.current >= MAX_CONCURRENT_PROCESSING) {
          console.log('⏭️ [AUDIO-AUTO] POLLING pausado - muitos processamentos ativos:', clientProcessingCount.current);
          return;
        }

        console.log('🔄 [AUDIO-AUTO] Verificando áudios pendentes via polling...', {
          realtimeInactive,
          processingCount: clientProcessingCount.current,
          processingIds: Array.from(processingRef.current)
        });
        
        // Buscar áudios pendentes COM verificação de status no banco
        const { data: pendingAudios, error } = await supabase
          .from('ticket_messages')
          .select(`
            *,
            conversation_tickets!inner(client_id, chat_id, instance_id)
          `)
          .in('message_type', ['audio', 'ptt'])
          .eq('processing_status', 'received')
          .eq('conversation_tickets.client_id', clientId)
          .order('timestamp', { ascending: true })
          .limit(3); // Reduzir para 3 para evitar sobrecarga

        if (error) {
          console.error('❌ [AUDIO-AUTO] Erro no polling:', error);
          return;
        }

        if (pendingAudios && pendingAudios.length > 0) {
          console.log(`🔍 [AUDIO-AUTO] POLLING encontrou ${pendingAudios.length} áudios pendentes`);
          
          for (const audio of pendingAudios) {
            // Verificação dupla: ref local + status do banco
            if (processingRef.current.has(audio.message_id)) {
              console.log(`⏭️ [AUDIO-AUTO] POLLING - áudio já em processamento (ref): ${audio.message_id}`);
              continue;
            }

            // Verificar se outro processo já está processando (status no banco)
            const { data: currentStatus } = await supabase
              .from('ticket_messages')
              .select('processing_status')
              .eq('message_id', audio.message_id)
              .single();

            if (currentStatus?.processing_status === 'processing') {
              console.log(`⏭️ [AUDIO-AUTO] POLLING - áudio já em processamento (banco): ${audio.message_id}`);
              continue;
            }

            // 🚫 PARAR PROCESSAMENTO DUPLICADO: Se não está no estado inicial, significa que o batch já processou
            if (currentStatus?.processing_status !== 'received') {
              console.log(`✅ [AUDIO-AUTO] POLLING - áudio já processado pelo batch: ${audio.message_id} -> ${currentStatus?.processing_status}`);
              continue;
            }

            console.log(`🎯 [AUDIO-AUTO] POLLING processando áudio: ${audio.message_id} (origem: polling)`);
            
            // Usar processamento com controle melhorado
            await processAudioWithControl(audio, audio.conversation_tickets, clientId, 'polling');
          }
        } else {
          console.log('✅ [AUDIO-AUTO] POLLING: Nenhum áudio pendente encontrado');
        }
      } catch (error) {
        console.error('❌ [AUDIO-AUTO] Erro crítico no polling:', error);
      }
    };

    // Adicionar função de processamento com controle
    const processAudioWithControl = async (message: any, ticket: any, clientId: string, source: string) => {
      const messageId = message.message_id;
      
      // Verificar limites de processamento
      if (clientProcessingCount.current >= MAX_CONCURRENT_PROCESSING) {
        console.log(`⏭️ [AUDIO-AUTO] LIMITE - não processando ${messageId} (${clientProcessingCount.current}/${MAX_CONCURRENT_PROCESSING})`);
        return;
      }

      // Marcar como processando
      processingRef.current.add(messageId);
      clientProcessingCount.current++;
      
      // Configurar timeout de limpeza
      const timeout = setTimeout(() => {
        console.log(`⏰ [AUDIO-AUTO] TIMEOUT - limpando processamento de ${messageId}`);
        processingRef.current.delete(messageId);
        clientProcessingCount.current = Math.max(0, clientProcessingCount.current - 1);
        processingTimeouts.current.delete(messageId);
      }, PROCESSING_TIMEOUT);
      
      processingTimeouts.current.set(messageId, timeout);

      try {
        console.log(`🎯 [AUDIO-AUTO] INICIANDO processamento: ${messageId} (origem: ${source}, total: ${clientProcessingCount.current})`);
        await processAudioMessage(message, ticket, clientId);
        console.log(`✅ [AUDIO-AUTO] CONCLUÍDO processamento: ${messageId} (origem: ${source})`);
      } catch (error) {
        console.error(`❌ [AUDIO-AUTO] ERRO no processamento ${messageId} (origem: ${source}):`, error);
      } finally {
        // Limpeza garantida
        processingRef.current.delete(messageId);
        clientProcessingCount.current = Math.max(0, clientProcessingCount.current - 1);
        
        const existingTimeout = processingTimeouts.current.get(messageId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          processingTimeouts.current.delete(messageId);
        }
        
        console.log(`🧹 [AUDIO-AUTO] LIMPEZA: ${messageId} (total restante: ${clientProcessingCount.current})`);
      }
    };

    // Iniciar polling de fallback a cada 30 segundos (otimizado)
    pollingIntervalRef.current = setInterval(checkPendingAudios, POLLING_COOLDOWN);
    console.log(`⏰ [AUDIO-AUTO] Polling de fallback iniciado (${POLLING_COOLDOWN/1000}s)`);

    // Listener para novas mensagens de áudio
    console.log('📡 [AUDIO-AUTO] Configurando listener realtime...');
    const channel = supabase
      .channel('audio_auto_processor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `message_type=in.(audio,ptt)`
        },
        async (payload) => {
          // Marcar atividade realtime
          lastRealtimeActivity.current = Date.now();
          
          console.log('📨 [AUDIO-AUTO] LISTENER ATIVO - Nova mensagem recebida via realtime');
          console.log('📨 [AUDIO-AUTO] Payload completo:', JSON.stringify(payload, null, 2));
          const newMessage = payload.new as any;
          
          console.log('🎵 [AUDIO-AUTO] 📨 NOVA MENSAGEM DETECTADA:', {
            messageId: newMessage.message_id,
            messageType: newMessage.message_type,
            fromMe: newMessage.from_me,
            isAiResponse: newMessage.is_ai_response,
            hasMediaKey: !!newMessage.media_key,
            processingStatus: newMessage.processing_status
          });
          
          // Verificar se é uma mensagem do cliente (NÃO from_me e NÃO is_ai_response)
          if (newMessage.from_me === true || newMessage.is_ai_response === true) {
            console.log('🎵 [AUDIO-AUTO] ⏭️ Ignorando áudio do assistente ou enviado pelo sistema');
            return;
          }

          // Verificar se já está sendo processado
          if (processingRef.current.has(newMessage.message_id)) {
            console.log('🎵 [AUDIO-AUTO] Áudio já em processamento (ref):', newMessage.message_id);
            return;
          }

          // Buscar ticket para verificar se é do cliente correto
          const { data: ticket } = await supabase
            .from('conversation_tickets')
            .select('client_id, chat_id, instance_id')
            .eq('id', newMessage.ticket_id)
            .single();

          if (!ticket || ticket.client_id !== clientId) {
            console.log('🎵 [AUDIO-AUTO] ⚠️ Ticket não pertence ao cliente atual:', {
              ticketClientId: ticket?.client_id,
              currentClientId: clientId
            });
            return;
          }

          // Verificar se já foi processado ou se não está pronto para processamento
          if (newMessage.processing_status !== 'received') {
            console.log('🎵 [AUDIO-AUTO] ⏭️ Áudio não está pronto para processamento:', {
              status: newMessage.processing_status,
              messageId: newMessage.message_id
            });
            return;
          }

          console.log('🎵 [AUDIO-AUTO] 🎯 NOVO ÁUDIO VÁLIDO PARA PROCESSAMENTO:', {
            messageId: newMessage.message_id,
            ticketId: newMessage.ticket_id,
            chatId: ticket.chat_id,
            processingStatus: newMessage.processing_status
          });

          // Usar processamento com controle melhorado
          await processAudioWithControl(newMessage, ticket, clientId, 'realtime');
        }
      )
      .subscribe((status) => {
        console.log('📡 [AUDIO-AUTO] Status da conexão realtime:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [AUDIO-AUTO] Listener realtime CONECTADO com sucesso');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [AUDIO-AUTO] ERRO na conexão realtime');
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ [AUDIO-AUTO] TIMEOUT na conexão realtime');
        }
      });

    channelRef.current = channel;
    console.log('✅ [AUDIO-AUTO] Sistema completo inicializado (realtime + polling)');

    // Verificação inicial de áudios pendentes
    setTimeout(checkPendingAudios, 2000);

    return () => {
      console.log('🎵 [AUDIO-AUTO] 🔄 Parando processamento automático de áudios...');
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        console.log('⏰ [AUDIO-AUTO] Polling de fallback parado');
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log('📡 [AUDIO-AUTO] Listener realtime removido');
      }
      
      // Limpar todos os timeouts de processamento
      processingTimeouts.current.forEach((timeout, messageId) => {
        clearTimeout(timeout);
        console.log(`🧹 [AUDIO-AUTO] Timeout limpo para: ${messageId}`);
      });
      processingTimeouts.current.clear();
      
      // Resetar contadores
      processingRef.current.clear();
      clientProcessingCount.current = 0;
      
      console.log('✅ [AUDIO-AUTO] Cleanup completo realizado');
    };
  }, [clientId]);

  /**
   * Processar mensagem de áudio automaticamente - VERSÃO SIMPLIFICADA
   */
  const processAudioMessage = async (message: any, ticket: any, clientId: string) => {
    try {
      console.log('🎵 [AUDIO-AUTO] ===== PROCESSANDO ÁUDIO AUTOMATICAMENTE =====');
      console.log('🎵 [AUDIO-AUTO] 📋 Dados completos da mensagem:', {
        messageId: message.message_id,
        hasMediaKey: !!message.media_key,
        hasMediaUrl: !!message.media_url,
        hasAudioBase64: !!message.audio_base64,
        mediaKeyType: typeof message.media_key,
        mediaUrlPreview: message.media_url?.substring(0, 100),
        mimetype: message.media_mime_type,
        directPath: message.direct_path,
        processingStatus: message.processing_status
      });

      // Marcar como "processing" imediatamente
      await supabase
        .from('ticket_messages')
        .update({ processing_status: 'processing' })
        .eq('message_id', message.message_id);

      console.log('🔄 [AUDIO-AUTO] Status atualizado para "processing"');

      let audioBase64 = '';

      // 🎯 CORREÇÃO DEFINITIVA: Implementar fallback para buscar dados de mídia
      let mediaData = {
        media_key: message.media_key,
        media_url: message.media_url,
        file_enc_sha256: message.file_enc_sha256,
        direct_path: message.direct_path,
        media_mime_type: message.media_mime_type,
        audio_base64: message.audio_base64
      };

      // Se não temos dados completos de mídia, buscar na whatsapp_messages
      if (!mediaData.media_key || !mediaData.media_url) {
        console.log('🔄 [AUDIO-AUTO] 🔍 Dados de mídia incompletos - buscando fallback...');
        console.log('🔄 [AUDIO-AUTO] 📊 Dados atuais:', {
          hasMediaKey: !!mediaData.media_key,
          hasMediaUrl: !!mediaData.media_url,
          hasFileEncSha256: !!mediaData.file_enc_sha256,
          messageId: message.message_id
        });

        const { data: whatsappMessage, error: fallbackError } = await supabase
          .from('whatsapp_messages')
          .select('media_url, media_key, file_enc_sha256, direct_path, media_mime_type')
          .eq('message_id', message.message_id)
          .single();

        if (fallbackError) {
          console.error('❌ [AUDIO-AUTO] Erro ao buscar fallback em whatsapp_messages:', fallbackError);
        } else if (whatsappMessage) {
          console.log('✅ [AUDIO-AUTO] 🎯 Dados de mídia encontrados via fallback:', {
            hasMediaKey: !!whatsappMessage.media_key,
            hasMediaUrl: !!whatsappMessage.media_url,
            hasFileEncSha256: !!whatsappMessage.file_enc_sha256,
            source: 'whatsapp_messages'
          });

          // Usar dados do fallback
          mediaData = {
            media_key: whatsappMessage.media_key || mediaData.media_key,
            media_url: whatsappMessage.media_url || mediaData.media_url,
            file_enc_sha256: whatsappMessage.file_enc_sha256 || mediaData.file_enc_sha256,
            direct_path: whatsappMessage.direct_path || mediaData.direct_path,
            media_mime_type: whatsappMessage.media_mime_type || mediaData.media_mime_type,
            audio_base64: mediaData.audio_base64
          };

          // Atualizar ticket_messages com os dados corretos para próximas execuções
          await supabase
            .from('ticket_messages')
            .update({
              media_url: mediaData.media_url,
              media_key: mediaData.media_key,
              file_enc_sha256: mediaData.file_enc_sha256,
              direct_path: mediaData.direct_path,
              media_mime_type: mediaData.media_mime_type
            })
            .eq('message_id', message.message_id);

          console.log('✅ [AUDIO-AUTO] 🔄 Dados de mídia sincronizados para ticket_messages');
        } else {
          console.warn('⚠️ [AUDIO-AUTO] Nenhum dado encontrado nem em ticket_messages nem em whatsapp_messages');
        }
      }

      // ✅ VERIFICAÇÃO CRÍTICA: Se já foi processado pelo batch system, não reprocessar
      if (mediaData.audio_base64) {
        console.log('✅ [AUDIO-AUTO] Áudio já descriptografado pelo batch system - usando diretamente');
        audioBase64 = mediaData.audio_base64;
      }
      // 1. ESTRATÉGIA COM DADOS CORRIGIDOS: Priorizar media_key para descriptografia
      else if (mediaData.media_key && mediaData.media_url) {
        console.log('🔐 [AUDIO-AUTO] 🔑 Áudio criptografado detectado - iniciando descriptografia');
        console.log('🔐 [AUDIO-AUTO] 📊 Parâmetros de descriptografia:', {
          instanceId: ticket.instance_id,
          mediaKeyLength: typeof mediaData.media_key === 'string' ? mediaData.media_key.length : 'object',
          mediaUrlDomain: new URL(mediaData.media_url).hostname,
          directPath: mediaData.direct_path,
          mimetype: mediaData.media_mime_type || 'audio/ogg'
        });
        
        const downloadResult = await directMediaDownloadService.downloadMedia(
          ticket.instance_id,
          mediaData.media_url,
          mediaData.media_key,
          mediaData.direct_path,
          mediaData.media_mime_type || 'audio/ogg',
          'audio'
        );

        if (downloadResult.success && downloadResult.mediaUrl) {
          console.log('✅ [AUDIO-AUTO] 🎉 Áudio descriptografado com sucesso pelo servidor');
          console.log('✅ [AUDIO-AUTO] 📁 URL descriptografada:', downloadResult.mediaUrl.substring(0, 50) + '...');
          
          // Converter blob URL para base64 com tratamento robusto
          try {
            console.log('🔄 [AUDIO-AUTO] Convertendo blob URL para base64...');
            const response = await fetch(downloadResult.mediaUrl);
            
            if (!response.ok) {
              throw new Error(`Falha ao fetch blob: ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log('📦 [AUDIO-AUTO] Blob obtido:', {
              size: blob.size,
              type: blob.type
            });
            
            if (blob.size === 0) {
              throw new Error('Blob vazio recebido');
            }
            
            const arrayBuffer = await blob.arrayBuffer();
            audioBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            console.log('✅ [AUDIO-AUTO] 🎯 Base64 gerado:', {
              length: audioBase64.length,
              preview: audioBase64.substring(0, 50) + '...'
            });
          } catch (convertError) {
            console.error('❌ [AUDIO-AUTO] Erro na conversão blob->base64:', convertError);
            throw new Error(`Falha na conversão: ${convertError.message}`);
          }
        } else {
          console.error('❌ [AUDIO-AUTO] 💥 Falha na descriptografia:', downloadResult.error);
          throw new Error(downloadResult.error || 'Serviço de descriptografia falhou');
        }
      } else if (mediaData.audio_base64) {
        console.log('📁 [AUDIO-AUTO] Usando áudio base64 da mensagem');
        audioBase64 = mediaData.audio_base64;
      } else {
        console.error('❌ [AUDIO-AUTO] Nenhum dado de áudio disponível');
        throw new Error('Nenhum dado de áudio disponível para transcrição');
      }

      // 2. Validar se temos áudio para processar
      if (!audioBase64 || audioBase64.length < 100) {
        console.error('❌ [AUDIO-AUTO] Dados de áudio inválidos:', {
          hasAudioBase64: !!audioBase64,
          length: audioBase64?.length || 0
        });
        throw new Error('Dados de áudio inválidos ou muito pequenos');
      }

      // 3. Buscar OpenAI API key do cliente
      console.log('🔑 [AUDIO-AUTO] Buscando configuração IA do cliente...');
      const aiConfig = await aiConfigService.getClientConfig(clientId);

      if (!aiConfig?.openai_api_key) {
        console.error('❌ [AUDIO-AUTO] API key da OpenAI não encontrada para cliente:', clientId);
        throw new Error('API key da OpenAI não configurada para este cliente');
      }

      console.log('✅ [AUDIO-AUTO] API key encontrada, length:', aiConfig.openai_api_key.length);

      // 4. Chamar edge function speech-to-text com logs detalhados
      console.log('🎤 [AUDIO-AUTO] 🚀 Invocando speech-to-text edge function...');
      console.log('🎤 [AUDIO-AUTO] 📋 Parâmetros da chamada:', {
        hasAudio: !!audioBase64,
        audioLength: audioBase64.length,
        hasApiKey: !!aiConfig.openai_api_key,
        messageId: message.message_id,
        audioPreview: audioBase64.substring(0, 50) + '...'
      });

      const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: audioBase64,
          openaiApiKey: aiConfig.openai_api_key,
          messageId: message.message_id
        }
      });

      console.log('🎤 [AUDIO-AUTO] 📥 Resposta da edge function:', {
        hasData: !!transcriptionResult,
        hasError: !!transcriptionError,
        dataPreview: transcriptionResult ? Object.keys(transcriptionResult) : 'N/A'
      });

      if (transcriptionError) {
        console.error('❌ [AUDIO-AUTO] 💥 Erro na edge function speech-to-text:', transcriptionError);
        throw new Error(`Edge function falhou: ${transcriptionError.message || 'Erro desconhecido'}`);
      }

      if (!transcriptionResult) {
        console.error('❌ [AUDIO-AUTO] Edge function retornou dados vazios');
        throw new Error('Edge function speech-to-text retornou resposta vazia');
      }

      const transcription = transcriptionResult?.text || '';
      console.log('✅ [AUDIO-AUTO] 🎯 Transcrição recebida:', {
        hasText: !!transcription,
        length: transcription.length,
        preview: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
        language: transcriptionResult?.language,
        success: transcriptionResult?.success
      });

      // 5. Salvar transcrição no banco com validação
      if (transcription && transcription.trim().length > 0) {
        console.log('💾 [AUDIO-AUTO] Salvando transcrição no banco...');
        
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update({
            media_transcription: transcription.trim(),
            processing_status: 'completed',
            content: `🎵 Áudio - Transcrição: ${transcription.trim()}`
          })
          .eq('message_id', message.message_id);

        if (updateError) {
          console.error('❌ [AUDIO-AUTO] Erro ao salvar transcrição:', updateError);
          throw new Error(`Falha ao salvar transcrição: ${updateError.message}`);
        }

        console.log('✅ [AUDIO-AUTO] 💾 Transcrição salva com sucesso no banco');
        console.log('🎯 [AUDIO-AUTO] ✅ PROCESSAMENTO COMPLETO - Deixando sistema de batch processar a mensagem transcrita');
      } else {
        console.log('⚠️ [AUDIO-AUTO] ❌ Transcrição vazia ou inválida');
        
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update({
            processing_status: 'failed',
            media_transcription: '[Transcrição vazia - áudio não pôde ser processado]',
            content: `🎵 Áudio - [Falha na transcrição]`
          })
          .eq('message_id', message.message_id);

        if (updateError) {
          console.error('❌ [AUDIO-AUTO] Erro ao marcar falha:', updateError);
        }
        
        throw new Error('Transcrição resultou em texto vazio');
      }

    } catch (error) {
      console.error('❌ [AUDIO-AUTO] 💥 ERRO CRÍTICO no processamento automático:', error);
      console.error('❌ [AUDIO-AUTO] Stack trace:', error.stack);
      
      // Marcar como erro no banco com detalhes
      const { error: updateError } = await supabase
        .from('ticket_messages')
        .update({
          processing_status: 'failed',
          media_transcription: `[Erro no processamento]: ${error.message}`,
          content: `🎵 Áudio - [Erro: ${error.message}]`
        })
        .eq('message_id', message.message_id);

      if (updateError) {
        console.error('❌ [AUDIO-AUTO] Erro ao salvar status de falha:', updateError);
      }
      
      // Re-throw para debugging se necessário
      console.error('❌ [AUDIO-AUTO] Processamento falhou para mensagem:', message.message_id);
    }
  };

  return {};
};