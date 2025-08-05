import { supabase } from "@/integrations/supabase/client";

/**
 * Serviço para detectar e corrigir transcrições inválidas "Amara.org"
 */
export const amaraTranscriptionFixer = {
  /**
   * Detecta mensagens com transcrições inválidas do tipo "Amara.org"
   */
  async findInvalidTranscriptions(clientId?: string) {
    console.log('🔍 Buscando transcrições inválidas "Amara.org"...');
    
    let query = supabase
      .from('ticket_messages')
      .select(`
        id, 
        message_id, 
        media_transcription, 
        processing_status, 
        audio_base64,
        created_at,
        ticket_id,
        conversation_tickets!inner(client_id)
      `)
      .eq('message_type', 'audio')
      .not('media_transcription', 'is', null);
      
    if (clientId) {
      query = query.eq('conversation_tickets.client_id', clientId);
    }

    const { data: messages, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Erro ao buscar mensagens:', error);
      return [];
    }

    // Filtrar mensagens com transcrições inválidas
    const invalidTranscriptions = [
      'Legendas pela comunidade Amara.org',
      'Legendas por Amara.org', 
      'Amara.org',
      'legendas pela comunidade amara',
      'comunidade amara',
      'amara org',
      'Subtitles by the Amara.org community',
      'Captions by Amara.org'
    ];

    const invalidMessages = messages?.filter(message => {
      const transcription = message.media_transcription || '';
      return invalidTranscriptions.some(invalid => 
        transcription.toLowerCase().includes(invalid.toLowerCase())
      );
    }) || [];

    console.log(`🚨 Encontradas ${invalidMessages.length} mensagens com transcrições inválidas`);
    
    return invalidMessages.map(msg => ({
      id: msg.id,
      messageId: msg.message_id,
      transcription: msg.media_transcription,
      hasAudio: !!msg.audio_base64,
      ticketId: msg.ticket_id,
      createdAt: msg.created_at
    }));
  },

  /**
   * Marca mensagens com transcrições inválidas para reprocessamento
   */
  async markForReprocessing(messageIds: string[]) {
    console.log(`🔄 Marcando ${messageIds.length} mensagens para reprocessamento...`);
    
    const { data, error } = await supabase
      .from('ticket_messages')
      .update({
        media_transcription: null,
        processing_status: 'pending_transcription'
      })
      .in('message_id', messageIds)
      .select('message_id, processing_status');

    if (error) {
      console.error('❌ Erro ao marcar mensagens:', error);
      throw error;
    }

    console.log(`✅ ${data?.length || 0} mensagens marcadas para reprocessamento`);
    return data;
  },

  /**
   * Limpa transcrições inválidas (remove o texto mas mantém o áudio)
   */
  async cleanInvalidTranscriptions(messageIds: string[]) {
    console.log(`🧹 Limpando ${messageIds.length} transcrições inválidas...`);
    
    const { data, error } = await supabase
      .from('ticket_messages')
      .update({
        media_transcription: '[Transcrição removida - conteúdo inválido detectado]',
        processing_status: 'transcription_failed'
      })
      .in('message_id', messageIds)
      .select('message_id, media_transcription');

    if (error) {
      console.error('❌ Erro ao limpar transcrições:', error);
      throw error;
    }

    console.log(`✅ ${data?.length || 0} transcrições inválidas limpas`);
    return data;
  },

  /**
   * Força reprocessamento de uma mensagem específica via edge function
   */
  async forceReprocessMessage(messageId: string, audioBase64: string, clientId: string) {
    console.log(`🚀 Forçando reprocessamento da mensagem: ${messageId}`);
    
    try {
      // Buscar configuração de IA do cliente
      const { data: aiConfig, error: configError } = await supabase
        .from('client_ai_configs')
        .select('openai_api_key')
        .eq('client_id', clientId)
        .single();

      if (configError || !aiConfig?.openai_api_key) {
        throw new Error('Configuração de IA não encontrada');
      }

      // Chamar edge function diretamente
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: audioBase64,
          openaiApiKey: aiConfig.openai_api_key,
          messageId
        }
      });

      if (error) {
        console.error('❌ Erro na edge function:', error);
        throw error;
      }

      console.log('📡 Resposta da edge function:', {
        success: data?.success,
        hasText: !!data?.text,
        textPreview: data?.text?.substring(0, 50),
        error: data?.error
      });

      // Atualizar mensagem com nova transcrição
      if (data?.text && data?.success && !this.isInvalidTranscription(data.text)) {
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update({
            media_transcription: data.text,
            processing_status: 'completed'
          })
          .eq('message_id', messageId);

        if (updateError) {
          console.error('❌ Erro ao atualizar mensagem:', updateError);
          throw updateError;
        }

        console.log('✅ Mensagem reprocessada com sucesso!');
        return { success: true, transcription: data.text };
      } else {
        // Falhou novamente
        const { error: updateError } = await supabase
          .from('ticket_messages')
          .update({
            media_transcription: '[Áudio não pôde ser transcrito após correção]',
            processing_status: 'transcription_failed'
          })
          .eq('message_id', messageId);

        console.warn('⚠️ Reprocessamento falhou - áudio mantido sem transcrição');
        return { success: false, error: data?.error || 'Reprocessamento falhou' };
      }

    } catch (error) {
      console.error('❌ Erro crítico no reprocessamento:', error);
      throw error;
    }
  },

  /**
   * Verifica se uma transcrição é inválida
   */
  isInvalidTranscription(text: string): boolean {
    const invalidTranscriptions = [
      'Legendas pela comunidade Amara.org',
      'Legendas por Amara.org', 
      'Amara.org',
      'legendas pela comunidade amara',
      'comunidade amara',
      'amara org',
      'Subtitles by the Amara.org community',
      'Captions by Amara.org'
    ];

    return invalidTranscriptions.some(invalid => 
      text.toLowerCase().includes(invalid.toLowerCase())
    );
  }
};