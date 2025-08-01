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
  text: string;
  success: boolean;
  error?: string;
}

class WhatsAppAudioService {
  private cache = new Map<string, DecryptedAudio>();

  /**
   * Descriptografa áudio do WhatsApp usando directMediaDownloadService
   */
  async decryptAudio(audioData: WhatsAppAudioData): Promise<DecryptedAudio> {
    console.log('🔐 [AUDIO-SERVICE] Iniciando descriptografia:', {
      messageId: audioData.messageId,
      hasEncryptedData: !!audioData.encryptedData,
      hasMediaKey: !!audioData.mediaKey,
      hasAudioUrl: !!audioData.audioUrl
    });

    // Verificar cache local primeiro
    if (this.cache.has(audioData.messageId)) {
      console.log('⚡ [AUDIO-SERVICE] Áudio encontrado no cache local');
      return this.cache.get(audioData.messageId)!;
    }

    try {
      // Buscar instanceId da URL atual
      const instanceId = await this.getInstanceIdFromUrl();
      if (!instanceId) {
        throw new Error('Instance ID não encontrado na URL');
      }

      // Usar directMediaDownloadService para descriptografar
      console.log('🎯 [AUDIO-SERVICE] Usando directMediaDownloadService');
      const result = await directMediaDownloadService.processMedia(
        instanceId,
        audioData.messageId,
        audioData.audioUrl || '',
        audioData.mediaKey,
        audioData.directPath,
        'audio/ogg',
        'audio'
      );

      if (!result.success || !result.mediaUrl) {
        throw new Error(`Falha no download: ${result.error || 'URL não disponível'}`);
      }

      // Converter blob URL para base64 se necessário
      let decryptedData = result.mediaUrl;
      if (result.mediaUrl.startsWith('blob:')) {
        try {
          const response = await fetch(result.mediaUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1]; // Remove data:audio/ogg;base64,
              resolve(base64);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          decryptedData = await base64Promise;
        } catch (error) {
          console.warn('⚠️ [AUDIO-SERVICE] Falha ao converter para base64, usando blob URL');
        }
      }

      const decryptedAudio: DecryptedAudio = {
        decryptedData,
        format: 'ogg',
        cached: result.cached || false
      };

      // Salvar no cache local
      this.cache.set(audioData.messageId, decryptedAudio);

      console.log('✅ [AUDIO-SERVICE] Descriptografia concluída:', {
        format: decryptedAudio.format,
        cached: decryptedAudio.cached,
        dataLength: decryptedAudio.decryptedData.length,
        isBlob: decryptedAudio.decryptedData.startsWith('blob:')
      });

      return decryptedAudio;

    } catch (error) {
      console.error('❌ [AUDIO-SERVICE] Erro crítico na descriptografia:', error);
      
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