/**
 * WhatsApp Audio Service
 * Gerencia descriptografia e processamento de áudios do WhatsApp
 */

import { supabase } from "@/integrations/supabase/client";

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
  text: string;
  success: boolean;
  error?: string;
}

class WhatsAppAudioService {
  private cache = new Map<string, DecryptedAudio>();

  /**
   * Descriptografa áudio do WhatsApp
   */
  async decryptAudio(audioData: WhatsAppAudioData): Promise<DecryptedAudio> {
    console.log('🔐 [AUDIO-SERVICE] Iniciando descriptografia:', {
      messageId: audioData.messageId,
      hasEncryptedData: !!audioData.encryptedData,
      hasMediaKey: !!audioData.mediaKey
    });

    // Verificar cache local primeiro
    if (this.cache.has(audioData.messageId)) {
      console.log('⚡ [AUDIO-SERVICE] Áudio encontrado no cache local');
      return this.cache.get(audioData.messageId)!;
    }

    try {
      // Chamar edge function de descriptografia
      const { data, error } = await supabase.functions.invoke('whatsapp-decrypt-audio', {
        body: {
          encryptedData: audioData.encryptedData,
          mediaKey: audioData.mediaKey,
          fileEncSha256: audioData.fileEncSha256,
          messageId: audioData.messageId
        }
      });

      if (error) {
        console.error('❌ [AUDIO-SERVICE] Erro na descriptografia:', error);
        throw new Error(`Falha na descriptografia: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(`Descriptografia falhou: ${data.error}`);
      }

      const result: DecryptedAudio = {
        decryptedData: data.decryptedAudio,
        format: data.format,
        cached: data.cached || false
      };

      // Salvar no cache local
      this.cache.set(audioData.messageId, result);

      console.log('✅ [AUDIO-SERVICE] Descriptografia concluída:', {
        format: result.format,
        cached: result.cached,
        dataLength: result.decryptedData.length
      });

      return result;

    } catch (error) {
      console.error('❌ [AUDIO-SERVICE] Erro crítico na descriptografia:', error);
      throw error;
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

      if (data?.error) {
        console.error('❌ [AUDIO-SERVICE] Erro retornado pela API:', data.error);
        return {
          text: '[Erro na transcrição]',
          success: false,
          error: data.error
        };
      }

      const transcriptionText = data?.text || '';
      console.log('✅ [AUDIO-SERVICE] Transcrição concluída:', {
        textLength: transcriptionText.length,
        success: !!transcriptionText
      });

      return {
        text: transcriptionText || '[Áudio não pôde ser transcrito]',
        success: !!transcriptionText
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
      (message.media_key || message.audio_base64)
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
}

export const whatsappAudioService = new WhatsAppAudioService();
export default whatsappAudioService;