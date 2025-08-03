
import { yumerApiV2 } from '@/services/yumerApiV2Service';
import { AudioConverter } from '@/utils/audioConverter';
import { AudioUploadService } from '@/services/audioUploadService';

export interface AudioSendResult {
  success: boolean;
  format?: string;
  error?: string;
  attempts?: number;
  isFallback?: boolean;
  message?: string;
}

export class AudioSender {
  static async sendWithIntelligentRetry(
    audioBlob: Blob,
    chatId: string,
    instanceId: string,
    messageId: string,
    duration?: number
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== ENVIO SIMPLIFICADO AUDIOFILE =====');
    console.log('📊 Dados:', { size: audioBlob.size, type: audioBlob.type, chatId, duration });

    try {
      // TENTATIVA ÚNICA E DIRETA
      console.log('🎵 Enviando via sendAudioFile...');
      const response = await yumerApiV2.sendAudioFile(instanceId, chatId, audioBlob, {
        delay: 1200,
        messageId: messageId,
        duration: duration
      });

      console.log('✅ Sucesso:', response);
      
      return {
        success: true,
        format: 'ogg',
        attempts: 1,
        message: 'Áudio enviado',
        isFallback: false
      };

    } catch (error: any) {
      console.error('❌ Erro completo:', error);
      return {
        success: false,
        error: error.message || 'Erro no envio',
        attempts: 1
      };
    }
  }

  // Método alternativo usando sendWhatsAppAudio (requer URL)
  static async sendViaWhatsAppAudio(
    audioUrl: string,
    chatId: string,
    instanceId: string,
    messageId: string
  ): Promise<AudioSendResult> {
    try {
      console.log('🎵 Enviando via sendWhatsAppAudio:', { audioUrl, chatId, instanceId });
      
      const response = await yumerApiV2.sendWhatsAppAudio(instanceId, chatId, audioUrl, {
        messageId: messageId
      });

      console.log('✅ Sucesso via sendWhatsAppAudio:', response);
      
      return {
        success: true,
        format: 'ogg',
        attempts: 1,
        message: 'Áudio enviado via sendWhatsAppAudio',
        isFallback: false
      };

    } catch (error: any) {
      console.error('❌ Erro via sendWhatsAppAudio:', error);
      return {
        success: false,
        error: error.message || 'Erro desconhecido',
        attempts: 1
      };
    }
  }

  // Método mantido por compatibilidade (agora sem funcionalidade)
  static async getAudioStats(instanceId: string): Promise<any> {
    console.warn('⚠️ getAudioStats: Método descontinuado com Yumer API v2');
    return null;
  }
}
