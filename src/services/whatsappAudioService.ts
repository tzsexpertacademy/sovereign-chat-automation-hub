/**
 * WhatsApp Audio Service
 * Gerencia descriptografia e processamento de áudios do WhatsApp
 */

import { supabase } from "@/integrations/supabase/client";
import { directMediaDownloadService } from './directMediaDownloadService';
import { useRetryWithBackoff } from '@/hooks/useRetryWithBackoff';

export interface WhatsAppAudioData {
  messageId: string;
  encryptedData?: string;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  audioUrl?: string;
}

export interface DecryptedAudio {
  decryptedData: string;
  format: string;
  cached: boolean;
}

export interface TranscriptionResult {
  text: string | null;
  success: boolean;
  error?: string;
  audioBase64?: string; // Adicionado para salvar áudio mesmo quando transcrição falha
}

class WhatsAppAudioService {
  private cache = new Map<string, DecryptedAudio>();

  /**
   * Descriptografa áudio do WhatsApp - DESATIVADO: useAudioAutoProcessor centraliza
   */
  async decryptAudio(audioData: WhatsAppAudioData): Promise<DecryptedAudio> {
    console.log('🛑 [AUDIO-SERVICE] DESATIVADO - useAudioAutoProcessor centraliza processamento');
    console.log('📋 [AUDIO-SERVICE] Para áudio:', audioData.messageId);

    // Verificar cache local primeiro
    if (this.cache.has(audioData.messageId)) {
      console.log('⚡ [AUDIO-SERVICE] Áudio encontrado no cache local');
      return this.cache.get(audioData.messageId)!;
    }

    // FALLBACK: Buscar base64 já processado na tabela
    try {
      const { data: message } = await supabase
        .from('ticket_messages')
        .select('audio_base64, media_transcription')
        .eq('message_id', audioData.messageId)
        .single();

      if (message?.audio_base64) {
        console.log('✅ [AUDIO-SERVICE] Base64 encontrado na tabela (já processado)');
        const cachedResult: DecryptedAudio = {
          decryptedData: message.audio_base64,
          format: 'ogg',
          cached: true
        };
        this.cache.set(audioData.messageId, cachedResult);
        return cachedResult;
      }

      console.log('⏳ [AUDIO-SERVICE] Aguardando useAudioAutoProcessor processar...');
      throw new Error('Áudio ainda não foi processado pelo useAudioAutoProcessor');

    } catch (error) {
      console.error('❌ [AUDIO-SERVICE] Erro ao buscar base64 processado:', error);
      
      // FALLBACK: Tentar usar URL direta se disponível
      if (audioData.audioUrl && !audioData.audioUrl.includes('.enc')) {
        console.log('🔄 [AUDIO-SERVICE] Usando URL direta como fallback');
        const fallbackResult: DecryptedAudio = {
          decryptedData: audioData.audioUrl,
          format: 'ogg',
          cached: false
        };
        this.cache.set(audioData.messageId, fallbackResult);
        return fallbackResult;
      }
      
      throw error;
    }
  }

  /**
   * Buscar instanceId da URL atual
   */
  private async getInstanceIdFromUrl(): Promise<string | null> {
    try {
      const currentUrl = window.location.pathname;
      const ticketIdMatch = currentUrl.match(/\/chat\/([^\/]+)/);
      
      if (ticketIdMatch) {
        const { data: ticketData } = await supabase
          .from('conversation_tickets')
          .select('instance_id')
          .eq('id', ticketIdMatch[1])
          .single();
        
        return ticketData?.instance_id || null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [AUDIO-SERVICE] Erro ao buscar instance ID:', error);
      return null;
    }
  }

  /**
   * Obtém áudio descriptografado da mensagem (cache local apenas por enquanto)
   */
  async getDecryptedAudio(messageId: string): Promise<DecryptedAudio | null> {
    try {
      // Verificar cache local primeiro
      if (this.cache.has(messageId)) {
        return this.cache.get(messageId)!;
      }

      // Por enquanto, retornar null se não estiver no cache local
      // TODO: Implementar busca no banco quando os tipos estiverem atualizados
      console.log('ℹ️ [AUDIO-SERVICE] Áudio não encontrado no cache local:', messageId);
      return null;

    } catch (error) {
      console.error('❌ [AUDIO-SERVICE] Erro ao buscar áudio:', error);
      return null;
    }
  }

  /**
   * Transcreve áudio usando OpenAI Whisper
   */
  async transcribeAudio(
    decryptedAudio: string, 
    clientId: string
  ): Promise<TranscriptionResult> {
    try {
      console.log('🎵 [AUDIO-SERVICE] Iniciando transcrição...');

      // Buscar configuração do cliente
      const { data: aiConfig, error: configError } = await supabase
        .from('client_ai_configs')
        .select('openai_api_key')
        .eq('client_id', clientId)
        .single();

      if (configError || !aiConfig?.openai_api_key) {
        throw new Error('Configuração de IA não encontrada para este cliente');
      }

      // Chamar serviço de transcrição
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: decryptedAudio,
          openaiApiKey: aiConfig.openai_api_key
        }
      });

      if (error) {
        console.error('❌ [AUDIO-SERVICE] Erro na transcrição:', error);
        return {
          text: '[Erro na transcrição]',
          success: false,
          error: error.message
        };
      }

      // Verificar se foi uma transcrição inválida (edge function já filtrou)
      if (data?.error || !data?.success) {
        console.warn('⚠️ [AUDIO-SERVICE] Edge function sinalizou erro:', data?.error);
        return {
          text: data?.shouldSaveAudio ? null : '[Erro na transcrição]', // null para não salvar texto inválido
          success: false,
          error: data?.error || 'Transcrição falhou',
          audioBase64: data?.shouldSaveAudio ? decryptedAudio : undefined // Salvar áudio mesmo com transcrição falha
        };
      }

      const resultText = data?.text || '';
      
      // Verificação adicional local de transcrições inválidas
      const invalidTranscriptions = [
        'Legendas pela comunidade Amara.org',
        'Legendas por Amara.org', 
        'Amara.org'
      ];
      
      const isInvalidTranscription = invalidTranscriptions.some(invalid => 
        resultText.toLowerCase().includes(invalid.toLowerCase())
      );

      if (isInvalidTranscription) {
        console.warn('🚨 [AUDIO-SERVICE] Transcrição inválida detectada localmente:', resultText);
        return {
          text: null, // Não salvar transcrição inválida
          success: false,
          error: 'Transcrição inválida detectada (Amara.org)',
          audioBase64: decryptedAudio // Salvar áudio mesmo com transcrição inválida
        };
      }

      console.log('✅ [AUDIO-SERVICE] Transcrição concluída:', {
        textLength: resultText.length,
        success: !!resultText,
        isValidTranscription: !isInvalidTranscription
      });

      return {
        text: resultText || '[Áudio não pôde ser transcrito]',
        success: !!resultText
      };

    } catch (error) {
      console.error('❌ [AUDIO-SERVICE] Erro crítico na transcrição:', error);
      return {
        text: '[Erro na transcrição]',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Processa áudio completo: descriptografia + transcrição
   */
  async processCompleteAudio(
    audioData: WhatsAppAudioData,
    clientId: string
  ): Promise<{
    decryptedAudio: DecryptedAudio;
    transcription: TranscriptionResult;
  }> {
    try {
      console.log('🔄 [AUDIO-SERVICE] Processamento completo iniciado:', audioData.messageId);

      // 1. Descriptografar áudio
      const decryptedAudio = await this.decryptAudio(audioData);

      // 2. Transcrever áudio descriptografado
      const transcription = await this.transcribeAudio(decryptedAudio.decryptedData, clientId);

      console.log('✅ [AUDIO-SERVICE] Processamento completo concluído:', {
        messageId: audioData.messageId,
        decryptionSuccess: true,
        transcriptionSuccess: transcription.success
      });

      return {
        decryptedAudio,
        transcription
      };

    } catch (error) {
      console.error('❌ [AUDIO-SERVICE] Erro no processamento completo:', error);
      throw error;
    }
  }

  /**
   * Limpa cache local
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 [AUDIO-SERVICE] Cache local limpo');
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats() {
    return {
      localCacheSize: this.cache.size,
      cachedMessages: Array.from(this.cache.keys())
    };
  }

  /**
   * Detecta se mensagem tem áudio criptografado
   */
  hasEncryptedAudio(message: any): boolean {
    return !!(
      message.message_type === 'audio' && 
      (message.media_key || message.audio_base64 || message.media_url)
    );
  }

  /**
   * Detecta se mensagem de áudio precisa de descriptografia
   */
  needsDecryption(message: any): boolean {
    return !!(
      message.message_type === 'audio' && 
      message.media_url?.includes('.enc') &&
      message.media_key &&
      message.file_enc_sha256
    );
  }

  /**
   * Extrai dados de áudio da mensagem
   */
  extractAudioData(message: any): WhatsAppAudioData | null {
    if (!this.hasEncryptedAudio(message)) {
      return null;
    }

    return {
      messageId: message.message_id || message.id,
      encryptedData: message.audio_base64,
      mediaKey: message.media_key,
      fileEncSha256: message.file_enc_sha256,
      directPath: message.direct_path,
      audioUrl: message.media_url
    };
  }

  /**
   * Obtém dados de áudio seguros para reprodução
   */
  getAudioPlaybackData(message: any): {
    audioData?: string;
    audioUrl?: string;
    messageId?: string;
    mediaKey?: string;
    fileEncSha256?: string;
    needsDecryption: boolean;
  } {
    if (message.message_type !== 'audio') {
      return { needsDecryption: false };
    }

    return {
      audioData: message.audio_base64,
      audioUrl: message.media_url,
      messageId: message.message_id || message.id,
      mediaKey: message.media_key,
      fileEncSha256: message.file_enc_sha256,
      needsDecryption: this.needsDecryption(message)
    };
  }
}

export const whatsappAudioService = new WhatsAppAudioService();
export default whatsappAudioService;