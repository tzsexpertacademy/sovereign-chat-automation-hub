
import { SERVER_URL } from '@/config/environment';
import { AudioConverter } from '@/utils/audioConverter';

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
    connectedInstance: string,
    messageId: string
  ): Promise<AudioSendResult> {
    console.log('🎵 ===== ENVIANDO VIA NOVO ENDPOINT MODULAR =====');
    console.log('🔧 Sistema refatorado: usando file-handlers.js');
    console.log('🎯 Endpoint: /api/clients/:id/send-audio (JSON+base64)');
    
    // Converter para formato otimizado (OGG por padrão)
    let processedBlob: Blob;
    try {
      processedBlob = await AudioConverter.convertToOGG(audioBlob);
    } catch (error) {
      console.warn('⚠️ Falha na conversão, usando áudio original:', error);
      processedBlob = audioBlob;
    }

    try {
      console.log('📤 Enviando para novo endpoint modular...');
      
      const result = await this.sendToModularEndpoint(
        processedBlob,
        chatId,
        connectedInstance,
        messageId
      );
      
      if (result.success) {
        console.log(`✅ Sucesso via endpoint modular:`, result);
        return result;
      } else {
        console.error('❌ Falha no endpoint modular:', result);
        return result;
      }
      
    } catch (error: any) {
      console.error('💥 Erro crítico no novo endpoint:', error);
      return { 
        success: false, 
        error: `Erro crítico: ${error.message}`,
        attempts: 0
      };
    }
  }

  private static async sendToModularEndpoint(
    audioBlob: Blob,
    chatId: string,
    connectedInstance: string,
    messageId: string
  ): Promise<AudioSendResult> {
    try {
      // Converter para base64
      const base64Audio = await AudioConverter.blobToBase64(audioBlob);
      
      // Preparar dados para o novo endpoint modular
      const requestData = {
        to: chatId,
        audioData: base64Audio,
        fileName: `audio_${messageId}.ogg`,
        mimeType: 'audio/ogg'
      };

      console.log('📊 Dados para endpoint modular:', {
        to: chatId,
        audioSize: audioBlob.size,
        base64Length: base64Audio.length,
        fileName: requestData.fileName,
        endpoint: `/api/clients/${connectedInstance}/send-audio`
      });

      // Enviar para novo endpoint modular
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${SERVER_URL}/api/clients/${connectedInstance}/send-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Resposta HTTP não OK do endpoint modular:', response.status, errorText);
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${errorText}` 
        };
      }

      const result = await response.json();
      
      console.log('📥 Resposta do endpoint modular:', result);
      
      if (result.success) {
        return {
          success: true,
          format: result.details?.format || 'ogg',
          attempts: result.details?.attempts || 1,
          isFallback: result.details?.isFallback || false,
          message: result.message || 'Áudio enviado com sucesso via endpoint modular'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Erro desconhecido do endpoint modular',
          attempts: result.details?.attempts || 0
        };
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { 
          success: false, 
          error: 'Timeout no endpoint modular (30s)',
          attempts: 1
        };
      }
      
      console.error('💥 Erro na requisição para endpoint modular:', error);
      return { 
        success: false, 
        error: `Erro de rede: ${error.message}`,
        attempts: 0
      };
    }
  }

  // Método para obter estatísticas do servidor via endpoint modular
  static async getAudioStats(connectedInstance: string): Promise<any> {
    try {
      const response = await fetch(`${SERVER_URL}/api/clients/${connectedInstance}/file-stats`);
      
      if (response.ok) {
        const stats = await response.json();
        console.log('📊 Estatísticas do endpoint modular:', stats);
        return stats;
      } else {
        console.warn('⚠️ Não foi possível obter estatísticas via endpoint modular');
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas do endpoint modular:', error);
      return null;
    }
  }
}
